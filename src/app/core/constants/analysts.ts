/** Analistas del equipo (mismos que las menciones de la pestaña Avisos). */
export interface Analyst {
  handle: string;   // mención de Telegram
  name: string;     // nombre para mostrar
}

export const ANALYSTS: Analyst[] = [
  { handle: '@MariAlejandra_Murcia', name: 'María Alejandra Murcia' },
  { handle: '@cynthiaracas', name: 'Cynthia Ramos' },
  { handle: '@JMiroslawaEstrada', name: 'Miroslawa Estrada' },
  { handle: '@Karenjuliethh', name: 'Karen Gutierrez' },
  { handle: '@GrisellQuiroz', name: 'Grisell Quiroz' },
  { handle: '@JohaGMora', name: 'Johana Galindo' },
  { handle: '@majovelasquez', name: 'Majo Velasquez' },
  { handle: '@Erikcastro23', name: 'Erik Castro' },
  { handle: '@ValentinaMesaB', name: 'Valentina Mesa' },
  { handle: '@CristianMRojas', name: 'Cristian Rojas' }
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Nombre para mostrar de una mención (@handle). Si no es conocida, devuelve el texto tal cual. */
export function analystLabel(handle: string): string {
  const a = ANALYSTS.find(x => x.handle === handle);
  return a ? a.name : handle;
}

/** Convierte un nombre completo (p. ej. del historial) en su mención, si coincide con un analista. */
export function handleFromName(fullName: string): string | null {
  const n = norm(fullName);
  if (!n) return null;
  const first = (s: string) => norm(s).split(' ').slice(0, 2).join(' ');
  const a = ANALYSTS.find(x => norm(x.name) === n || first(x.name) === first(fullName));
  return a ? a.handle : null;
}
