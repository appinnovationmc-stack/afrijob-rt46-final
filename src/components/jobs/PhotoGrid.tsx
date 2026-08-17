import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Camera as CameraIcon, Clock, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/components/ui/Toast';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { offlineDb, isLocalId } from '@/lib/offlineDb';
import { haptics } from '@/lib/haptics';
import type { Enums } from '@/types/database.types';
import type { DisplayPhoto } from '@/hooks/useJobs';

export function PhotoGrid({ jobId, stage, photos }: { jobId: string; stage: Enums<'photo_stage'>; photos: DisplayPhoto[] }) {
  const userId = useAuthStore((s) => s.user?.id);
  const push = useToastStore((s) => s.push);
  const online = useNetworkStatus();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const takePhoto = async () => {
    if (!userId) return;
    setUploading(true);
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        quality: 80,
        saveToGallery: false,
      });
      haptics.medium();

      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const pos = await Geolocation.getCurrentPosition({ timeout: 8000 });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        // GPS unavailable — proceed without coordinates rather than blocking the job card
      }

      // Queue instead of uploading straight away when offline, or when the
      // parent job itself hasn't synced yet (no real job_id to attach to).
      const shouldQueue = !online || isLocalId(jobId);
      if (shouldQueue) {
        await offlineDb.queuedPhotos.put({
          localId: crypto.randomUUID(),
          jobId,
          stage,
          dataUrl: `data:image/jpeg;base64,${photo.base64String}`,
          latitude,
          longitude,
          deviceInfo: navigator.userAgent,
          takenAt: new Date().toISOString(),
          synced: false,
        });
        qc.invalidateQueries({ queryKey: ['job-photos', jobId] });
        push('Photo saved — will upload once you\'re back online', 'info');
        return;
      }

      const path = `${jobId}/${stage}-${Date.now()}.jpg`;
      const bytes = Uint8Array.from(atob(photo.base64String!), (c) => c.charCodeAt(0));
      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, bytes, {
        contentType: 'image/jpeg',
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('job_photos').insert({
        job_id: jobId,
        uploaded_by: userId,
        stage,
        storage_path: path,
        latitude,
        longitude,
        device_info: navigator.userAgent,
        taken_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      qc.invalidateQueries({ queryKey: ['job-photos', jobId] });
      push('Photo added', 'success');
    } catch (e) {
      haptics.error();
      push(e instanceof Error ? e.message : 'Could not capture photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const stagePhotos = photos.filter((p) => p.stage === stage);

  return (
    <div className="grid grid-cols-3 gap-2">
      {stagePhotos.map((p) => (
        <PhotoThumb key={p.id} photo={p} />
      ))}
      <button
        onClick={takePhoto}
        disabled={uploading}
        className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-400"
      >
        {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CameraIcon className="w-6 h-6" />}
      </button>
    </div>
  );
}

function PhotoThumb({ photo }: { photo: DisplayPhoto }) {
  const src = photo._pendingSync ? photo._dataUrl : supabase.storage.from('job-photos').getPublicUrl(photo.storage_path).data.publicUrl;
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-charcoal-light">
      <img src={src} alt="Job photo" className="w-full h-full object-cover" loading="lazy" />
      {photo._pendingSync && (
        <div className="absolute bottom-1 right-1 bg-charcoal/80 text-white rounded-full p-1" title="Waiting to sync">
          <Clock className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}
