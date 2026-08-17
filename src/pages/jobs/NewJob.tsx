import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { useWorkshopStore } from '@/store/workshopStore';
import { useAuthStore } from '@/store/authStore';
import { useCreateJob } from '@/hooks/useJobs';
import { useToastStore } from '@/components/ui/Toast';
import { JOB_TYPE_LABELS } from '@/lib/utils';
import { isLocalId } from '@/lib/offlineDb';
import { haptics } from '@/lib/haptics';
import type { Enums } from '@/types/database.types';

const schema = z.object({
  vehicle_registration: z.string().min(2, 'Required'),
  vehicle_vin: z.string().optional(),
  vehicle_make: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_colour: z.string().optional(),
  odometer: z.coerce.number().optional(),
  job_type: z.custom<Enums<'job_type'>>((v) => typeof v === 'string' && v.length > 0, 'Select a job type'),
  description: z.string().optional(),
  priority: z.enum(['normal', 'urgent']),
});
type FormValues = z.infer<typeof schema>;

export default function NewJob() {
  const navigate = useNavigate();
  const workshop = useWorkshopStore((s) => s.activeWorkshop);
  const userId = useAuthStore((s) => s.user?.id);
  const push = useToastStore((s) => s.push);
  const createJob = useCreateJob();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'normal' },
  });

  const onSubmit = async (values: FormValues) => {
    if (!workshop || !userId) return;
    setSubmitting(true);
    try {
      const job = await createJob.mutateAsync({
        workshop_id: workshop.id,
        created_by: userId,
        vehicle_registration: values.vehicle_registration.toUpperCase(),
        vehicle_vin: values.vehicle_vin || null,
        vehicle_make: values.vehicle_make || null,
        vehicle_model: values.vehicle_model || null,
        vehicle_colour: values.vehicle_colour || null,
        odometer: values.odometer ?? null,
        job_type: values.job_type,
        description: values.description || null,
        priority: values.priority,
        status: 'draft',
      });
      haptics.success();
      push(isLocalId(job.id) ? 'Job saved offline — will sync automatically' : 'Job card created', isLocalId(job.id) ? 'info' : 'success');
      navigate(`/jobs/${job.id}`, { replace: true });
    } catch (e) {
      haptics.error();
      push(e instanceof Error ? e.message : 'Failed to create job', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="New Job" onBack />
      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-6 flex flex-col gap-4">
        <div>
          <label className="text-sm font-semibold mb-1.5 block">Vehicle Registration *</label>
          <input className="input font-mono uppercase" placeholder="e.g. CA 123-456" {...register('vehicle_registration')} />
          {errors.vehicle_registration && <p className="text-danger text-xs mt-1">{errors.vehicle_registration.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Make</label>
            <input className="input" placeholder="Toyota" {...register('vehicle_make')} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Model</label>
            <input className="input" placeholder="Hilux" {...register('vehicle_model')} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Colour</label>
            <input className="input" placeholder="White" {...register('vehicle_colour')} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Odometer</label>
            <input className="input" type="number" placeholder="120000" {...register('odometer')} />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold mb-1.5 block">VIN</label>
          <input className="input font-mono" {...register('vehicle_vin')} />
        </div>

        <div>
          <label className="text-sm font-semibold mb-1.5 block">Job Type *</label>
          <select className="input" {...register('job_type')} defaultValue="">
            <option value="" disabled>Select job type</option>
            {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {errors.job_type && <p className="text-danger text-xs mt-1">{errors.job_type.message}</p>}
        </div>

        <div>
          <label className="text-sm font-semibold mb-1.5 block">Priority</label>
          <div className="flex gap-3">
            <label className="flex-1">
              <input type="radio" value="normal" className="peer sr-only" {...register('priority')} />
              <div className="peer-checked:bg-brand peer-checked:text-white peer-checked:border-brand border border-gray-200 dark:border-gray-700 rounded-xl text-center py-3 font-semibold cursor-pointer">
                Normal
              </div>
            </label>
            <label className="flex-1">
              <input type="radio" value="urgent" className="peer sr-only" {...register('priority')} />
              <div className="peer-checked:bg-danger peer-checked:text-white peer-checked:border-danger border border-gray-200 dark:border-gray-700 rounded-xl text-center py-3 font-semibold cursor-pointer">
                Urgent
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold mb-1.5 block">Description / Customer Notes</label>
          <textarea className="input min-h-[100px]" {...register('description')} />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary mt-2">
          {submitting ? 'Creating…' : 'Create Job Card'}
        </button>
      </form>
    </div>
  );
}
