import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useAcceptInvitation } from '@/hooks/useTeam';

// Reached two ways:
// 1. Manual-share: an admin copies this link from the Team page and sends
//    it themselves. No URL hash — just ?token=...
// 2. Emailed invite (send-invitation-email edge function, Supabase Auth's
//    inviteUserByEmail): Supabase's own /auth/v1/verify endpoint redirects
//    here AFTER verifying the invite server-side, appending session tokens
//    as a URL hash fragment: #access_token=...&refresh_token=...&type=invite.
//    This is NOT the PKCE flow (Supabase doesn't support PKCE for Invite
//    yet, confirmed against their docs) — there is no `code` param to
//    exchange, just tokens already sitting in the hash. detectSessionInUrl
//    is off on this app's client (see lib/supabase.ts), so nothing
//    auto-consumes that hash; it's parsed and applied manually below via
//    setSession().
const PENDING_INVITE_KEY = 'afrijob:pending-invite-token';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuthStore();
  const acceptInvitation = useAcceptInvitation();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [errorMessage, setErrorMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('This invite link is missing its token.');
      return;
    }

    if (attempted.current) return;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    async function acceptWithSession() {
      attempted.current = true;
      acceptInvitation.mutate(token!, {
        onSuccess: () => {
          localStorage.removeItem(PENDING_INVITE_KEY);
          navigate('/', { replace: true });
        },
        onError: (err: any) => {
          setStatus('error');
          setErrorMessage(err?.message ?? 'Could not accept this invitation.');
        },
      });
    }

    if (accessToken && refreshToken) {
      // Came from the emailed link — establish the session directly from
      // the hash rather than waiting on the auth store, so this works even
      // if this is genuinely the person's first-ever session. Guard is set
      // immediately (not inside the .then()) so a re-render while the
      // async setSession call is still in flight can't fire a duplicate.
      attempted.current = true;
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        if (error) {
          setStatus('error');
          setErrorMessage('This invite link has expired or was already used — ask for a fresh one.');
          return;
        }
        acceptWithSession();
      });
      return;
    }

    // Manual-share path (no hash) — same as before: wait for auth state,
    // send to signup if not signed in yet, accept once we have a session.
    if (authLoading) return;

    if (!session) {
      localStorage.setItem(PENDING_INVITE_KEY, token);
      navigate('/signup', { replace: true });
      return;
    }

    acceptWithSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, session, authLoading]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-sm text-center">
          <p className="font-semibold mb-1">Couldn't accept this invite</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Joining organisation…</div>
  );
}

// Exported so the post-signup flow in App.tsx can pick this token up once
// it exists (see TODO there) rather than requiring the person to reopen
// the invite link after signing up.
export function getPendingInviteToken(): string | null {
  return localStorage.getItem(PENDING_INVITE_KEY);
}
