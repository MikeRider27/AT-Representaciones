import { Lock, User } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { Logo } from '@/components/Logo';
import { Alert, Button } from '@/components/ui';
import { errorMessage } from '@/lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-700/40" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent-400/10" />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-white">Ventas, stock, caja, recargas y billeteras en un solo lugar.</h2>
          <p className="mt-4 text-brand-200">
            Electrónica, electrodomésticos y accesorios · Giros, envíos, minicargas y maxicargas.
          </p>
        </div>
        <p className="relative text-xs text-brand-300">Luque · Paraguay</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <div className="inline-block rounded-xl bg-brand-900 p-3">
              <Logo />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-slate-500">Ingrese sus credenciales para continuar.</p>
          </div>

          {error && <Alert tone="red">{error}</Alert>}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Usuario</span>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  required
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Contraseña</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  required
                />
              </div>
            </label>
          </div>
          <Button type="submit" loading={loading} className="h-11 w-full">
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  );
}
