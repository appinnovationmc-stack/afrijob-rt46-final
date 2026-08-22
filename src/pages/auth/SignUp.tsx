import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/components/ui/Toast';
import { createOrganisationAndWorkshop } from '@/lib/organisations';

const schema = z.object({
  fullName: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
  workshopName: z.string().min(2, 'Enter your workshop name'),
});
type FormValues = z.infer<typeof schema>;

export default function SignUp() {
  const navigate = useNavigate();
  const push = useToastStore((s) => s.push);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    });
    if (error || !data.user) {
      setLoading(false);
      push(error?.message ?? 'Sign up failed', 'error');
      return;
    }

    // If email confirmation is required, signUp() returns a user but no
    // active session — there's nothing authenticated yet, so we can't
    // create the workshop now (RLS needs auth.uid()). Stash the name and
    // create it on first authenticated load instead (see App.tsx).
    if (!data.session) {
      localStorage.setItem('afrijob:pending-workshop-name', values.workshopName);
      setLoading(false);
      push('Account created — check your email to confirm, then sign in.', 'success');
      navigate('/login', { replace: true });
      return;
    }

    try {
      await createOrganisationAndWorkshop(supabase, data.user.id, values.workshopName);
    } catch (err: any) {
      setLoading(false);
      push(err.message ?? 'Failed to create workshop', 'error');
      return;
    }

    setLoading(false);

    push('Account created!', 'success');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <h1 className="font-heading font-bold text-2xl mb-1">Create your account</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Set up your workshop on AfriJob</p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <input className="input" placeholder="Full name" {...register('fullName')} />
          {errors.fullName && <p className="text-danger text-xs mt-1">{errors.fullName.message}</p>}
        </div>
        <div>
          <input className="input" placeholder="Workshop / business name" {...register('workshopName')} />
          {errors.workshopName && <p className="text-danger text-xs mt-1">{errors.workshopName.message}</p>}
        </div>
        <div>
          <input className="input" type="email" placeholder="Email" {...register('email')} />
          {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <input className="input" type="password" placeholder="Password" {...register('password')} />
          {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
        Already have an account? <Link to="/login" className="text-brand font-semibold">Sign in</Link>
      </p>
    </div>
  );
}
