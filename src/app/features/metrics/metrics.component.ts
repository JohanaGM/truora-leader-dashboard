import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TelegramLog, TelegramLogOrigin, TelegramLogStatus } from '../../core/models/telegram-log.model';

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metrics.component.html',
  styleUrl: './metrics.component.scss'
})
export class MetricsComponent {
  private readonly analystDirectory = [
    { email: 'lgalindo@truora.com', name: 'Johana Galindo' },
    { email: 'cmrojas@truora.com', name: 'Cristian Rojas' },
    { email: 'vmesa@truora.com', name: 'Valentina Mesa' },
    { email: 'jmiroslawa@truora.com', name: 'Miroslawa Estrada' },
    { email: 'efcastro@truora.com', name: 'Erik Castro' },
    { email: 'cyramos@truora.com', name: 'Cynthia Ramos' },
    { email: 'mjvelasquez@truora.com', name: 'Majo Velasquez' },
    { email: 'kjgutierrez@truora.com', name: 'Karen Gutierrez' },
  ];

  readonly logs = signal<TelegramLog[]>([
    { id: 'tg-001', sentAt: '2026-09-20T08:42:00-05:00', senderEmail: 'lgalindo@truora.com', senderName: 'Johana Galindo', origin: 'announcement', status: 'success', chatId: '@equipo-identidad', message: 'Equipo, recuerden revisar las alertas pendientes antes de las 10:00 a. m. y dejar documentado cualquier caso que requiera seguimiento.' },
    { id: 'tg-002', sentAt: '2026-09-20T11:15:00-05:00', senderEmail: 'vmesa@truora.com', senderName: 'Valentina Mesa', origin: 'tip', status: 'success', chatId: '@ValentinaMesaB', tipTitle: 'Revisión documental con contexto', imageUrl: 'assets/images/plantillafinalxfin.jpg', libraryUrl: '/dashboard', message: 'Antes de cerrar una revisión, valida que la evidencia corresponda al documento analizado, registra la decisión y comparte el contexto completo para que el siguiente turno pueda continuar sin perder información.' },
    { id: 'tg-003', sentAt: '2026-09-21T09:03:00-05:00', senderEmail: 'maria.alejandra@truora.com', senderName: 'María Alejandra', origin: 'announcement', status: 'error', chatId: '@equipo-identidad', message: 'La publicación de mantenimiento no pudo enviarse porque el webhook de Telegram no respondió dentro del tiempo esperado. El mensaje debe reintentarse cuando el servicio vuelva a estar disponible.' },
    { id: 'tg-004', sentAt: '2026-09-22T14:27:00-05:00', senderEmail: 'lgalindo@truora.com', senderName: 'Johana Galindo', origin: 'tip', status: 'success', chatId: '@lideres-truora', tipTitle: 'Convertir experiencia en práctica', imageUrl: 'assets/images/plantillafinalxfin.jpg', libraryUrl: '/dashboard', message: 'Generar un tip claro ayuda a convertir una experiencia puntual en una práctica repetible. Incluye una recomendación concreta, un ejemplo breve y el resultado que esperamos observar en el equipo.' }
  ]);

  selectedUser = signal('all');
  selectedDate = signal('');
  selectedOrigin = signal<'all' | TelegramLogOrigin>('all');

  readonly users = computed(() => {
    const unique = new Map(this.analystDirectory.map(user => [user.email, user.name]));
    for (const log of this.logs()) unique.set(log.senderEmail, log.senderName);
    return [...unique.entries()]
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly filteredLogs = computed(() => {
    const user = this.selectedUser();
    const date = this.selectedDate();
    const origin = this.selectedOrigin();
    return this.logs().filter(log =>
      (user === 'all' || log.senderEmail === user) &&
      (!date || log.sentAt.slice(0, 10) === date) &&
      (origin === 'all' || log.origin === origin)
    );
  });

  readonly summary = computed(() => {
    const total = this.filteredLogs().length;
    const user = this.selectedUser();
    const date = this.selectedDate();
    if (user === 'all' && !date && this.selectedOrigin() === 'all') return `Mostrando todos los envíos (Total: ${total})`;
    const userLabel = user === 'all' ? 'los analistas' : user;
    const dateLabel = date ? new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : 'el período seleccionado';
    return `Se encontraron ${total} ${total === 1 ? 'mensaje' : 'mensajes'} enviados por ${userLabel} ${dateLabel === 'el período seleccionado' ? dateLabel : `el ${dateLabel}`}`;
  });

  applyFilters(): void { this.selectedUser.set(this.selectedUser()); }
  setUser(value: string): void { this.selectedUser.set(value); this.applyFilters(); }
  setDate(value: string): void { this.selectedDate.set(value); this.applyFilters(); }
  setOrigin(value: string): void { this.selectedOrigin.set(value as 'all' | TelegramLogOrigin); this.applyFilters(); }
  clearFilters(): void { this.selectedUser.set('all'); this.selectedDate.set(''); this.selectedOrigin.set('all'); }
  originLabel(origin: TelegramLogOrigin): string { return origin === 'tip' ? 'Generar Tip' : 'Aviso'; }
  statusLabel(status: TelegramLogStatus): string { return status === 'success' ? 'Enviado' : 'Error'; }
}
