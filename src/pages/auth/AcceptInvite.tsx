import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAcceptInvitation } from '@/hooks/useTeam';

// Reached via /accept-invite?token=... — the link an admin copies from the
// Team page and shares manually (see Team.tsx). There is no automated
// invite email yet (needs a Supabase Edge Function deployed against the
// live project), so this page is the other half of a manual-share flow:
// whoever gets the link, signs in or signs up, and lands here to actually
// join the organisation.
const PENDING_INVITE_KEY = 'afrijob:pending-invite-token';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuthStore();
  const acceptInvitation = useAcceptInvitation();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('This invite link is missing its token.');
      return;
    }

    if (authLoading) return; // wait for auth state to resolve before deciding

    if (!session) {
      // Not signed in yet — stash the token and send them to sign up.
      // They'll need to be routed back here after auth; sign-up/login
      // don't currently read this key, so for now this also degrades
      // gracefully to "come back to this link after you've signed up".
      localStorage.setItem(PENDING_INVITE_KEY, token);
      navigate('/signup', { replace: true });
      return;
    }

    acceptInvitation.mutate(token, {
      onSuccess: () => {
        localStorage.removeItem(PENDING_INVITE_KEY);
        navigate('/', { replace: true });
      },
      onError: (err: any) => {
        setStatus('error');
        setErrorMessage(err?.message ?? 'Could not accept this invitation.');
      },
    });
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
