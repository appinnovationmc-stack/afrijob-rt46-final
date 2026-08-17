import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/components/ui/Toast';
import { Wrench } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const push = useToastStore((s) => s.push);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setLoading(false);
    if (error) {
      push(error.message, 'error');
      return;
    }
    navigate('/', { replace: true });
  };

  const onMagicLink = async () => {
    const email = prompt('Enter your email for a magic link:');
    if (!email) return;
    const { error } = await supabase.auth.signInWithOtp({ email });
    push(error ? error.message : 'Magic link sent — check your inbox.', error ? 'error' : 'success');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mb-4">
          <Wrench className="w-8 h-8 text-white" />
        </div>
        <h1 className="font-heading font-bold text-2xl">AfriJob</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Merchant Network Support</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <input className="input" type="email" placeholder="Email" {...register('email')} />
          {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <input className="input" type="password" placeholder="Password" {...register('password')} />
          {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <button onClick={onMagicLink} className="text-sm text-brand font-semibold mt-4 text-center">
        Sign in with a magic link instead
      </button>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
        New here? <Link to="/signup" className="text-brand font-semibold">Create an account</Link>
      </p>
    </div>
  );
}
