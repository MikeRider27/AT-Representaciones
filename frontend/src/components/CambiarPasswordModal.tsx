import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useApiMutation } from '@/lib/hooks';
import { Button, Field, Input, Modal } from './ui';

export function CambiarPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const mut = useApiMutation((body: { actual: string; nueva: string }) => api.put('/auth/password', body), {
    success: 'Contraseña actualizada',
    onSuccess: () => {
      setActual('');
      setNueva('');
      setConfirmar('');
      onClose();
    },
  });
  const noCoincide = confirmar.length > 0 && nueva !== confirmar;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (noCoincide) return;
    mut.mutate({ actual, nueva });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambiar contraseña"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="pwd-form" loading={mut.isPending} disabled={noCoincide || nueva.length < 8}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="pwd-form" onSubmit={submit} className="space-y-4">
        <Field label="Contraseña actual" required>
          <Input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres" required>
          <Input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required />
        </Field>
        <Field label="Confirmar nueva contraseña" error={noCoincide ? 'Las contraseñas no coinciden' : undefined} required>
          <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" required />
        </Field>
      </form>
    </Modal>
  );
}
