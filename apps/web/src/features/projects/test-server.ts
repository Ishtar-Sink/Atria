// API falsa em memória para os testes de Projetos: projetos, raias, cartões, tarefas e ligações,
// com as contas feitas como no servidor (progresso, resumo, reindexação ao mover).
import { vi } from 'vitest';
import type { Card, Lane, Project } from './use-projects';

type Task = { id: string; title: string; completed_at: string | null };
type Link = {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
};

export interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown>;
}

export interface Server {
  projects: Project[];
  lanes: Lane[];
  cards: Card[];
  tasks: Task[];
  links: Link[];
  calls: Call[];
  mode: 'ok' | 'loading' | 'error';
  /** Responde no lugar do servidor (recusar uma mudança) ou, com `hang`, nunca responde. */
  reject: ((call: Call) => Response | 'hang' | undefined) | undefined;
}

const NOW = '2026-03-01T10:00:00Z';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function problem(code: string, status: number): Response {
  return json({ code, title: code }, status);
}

export function laneOf(overrides: Partial<Lane> & { id: string }): Lane {
  return {
    color: '#6d28d9',
    counts_as_done: false,
    created_at: NOW,
    name: null,
    owner_id: 'u-1',
    position: 0,
    project_id: 'p-1',
    system_key: null,
    updated_at: NOW,
    visibility: 'personal',
    ...overrides,
  };
}

/** As três raias padrão de um projeto novo, com as cores e a marcação do servidor. */
export function defaultLanes(project_id = 'p-1'): Lane[] {
  return [
    laneOf({ id: 'l-wait', project_id, system_key: 'waiting', color: '#92400e', position: 0 }),
    laneOf({ id: 'l-doing', project_id, system_key: 'in_progress', color: '#6d28d9', position: 1 }),
    laneOf({
      id: 'l-done',
      project_id,
      system_key: 'done',
      color: '#047857',
      position: 2,
      counts_as_done: true,
    }),
  ];
}

export function cardOf(overrides: Partial<Card> & { id: string; title: string }): Card {
  return {
    checklist: [],
    created_at: NOW,
    description: null,
    due_date: null,
    labels: [],
    lane_id: 'l-wait',
    owner_id: 'u-1',
    position: 0,
    priority: null,
    project_id: 'p-1',
    updated_at: NOW,
    visibility: 'personal',
    ...overrides,
  };
}

export function projectOf(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p-1',
    owner_id: 'u-1',
    name: 'Reforma da sala',
    description: null,
    visibility: 'personal',
    lanes: [],
    progress: { done_cards: 0, total_cards: 0 },
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-02-06T10:00:00Z',
    ...overrides,
  };
}

function plusDays(date: string, days: number): string {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

/** Instala o `fetch` falso. Chame `vi.unstubAllGlobals()` ao fim de cada teste. */
export function stubServer(initial: Partial<Server> = {}): Server {
  const server: Server = {
    projects: [],
    lanes: [],
    cards: [],
    tasks: [],
    links: [],
    calls: [],
    mode: 'ok',
    reject: undefined,
    ...initial,
  };
  let counter = 0;
  const next_id = (prefix: string) => `${prefix}-${String((counter += 1))}`;
  const lanes_of = (id: string) =>
    server.lanes.filter((lane) => lane.project_id === id).sort((a, b) => a.position - b.position);
  const cards_of = (id: string) => server.cards.filter((card) => card.project_id === id);
  const progress = (id: string) => {
    const done_lanes = new Set(
      lanes_of(id)
        .filter((lane) => lane.counts_as_done)
        .map((lane) => lane.id),
    );
    const cards = cards_of(id);
    return {
      done_cards: cards.filter((card) => done_lanes.has(card.lane_id)).length,
      total_cards: cards.length,
    };
  };
  const view = (project: Project): Project => ({
    ...project,
    lanes: lanes_of(project.id),
    progress: progress(project.id),
  });
  const renumber = (project_id: string) => {
    lanes_of(project_id).forEach((lane) => {
      cards_of(project_id)
        .filter((card) => card.lane_id === lane.id)
        .sort((a, b) => a.position - b.position)
        .forEach((card, index) => {
          card.position = index;
        });
    });
  };
  const summary = (id: string, today: string) => {
    const lanes = lanes_of(id);
    const open = new Set(lanes.filter((lane) => !lane.counts_as_done).map((lane) => lane.id));
    const middle = new Set(lanes.slice(1, -1).map((lane) => lane.id));
    const cards = cards_of(id);
    return {
      progress: progress(id),
      lanes: lanes.map((lane) => ({
        lane_id: lane.id,
        name: lane.name,
        system_key: lane.system_key,
        color: lane.color,
        counts_as_done: lane.counts_as_done,
        card_count: cards.filter((card) => card.lane_id === lane.id).length,
      })),
      upcoming_due: cards
        .filter(
          (card) => open.has(card.lane_id) && card.due_date && card.due_date <= plusDays(today, 14),
        )
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
        .map((card) => ({
          card_id: card.id,
          title: card.title,
          lane_id: card.lane_id,
          due_date: String(card.due_date),
          overdue: String(card.due_date) < today,
        })),
      in_progress: cards
        .filter((card) => middle.has(card.lane_id))
        .map((card) => ({
          card_id: card.id,
          title: card.title,
          lane_id: card.lane_id,
          due_date: card.due_date,
          priority: card.priority,
          checklist_done: card.checklist.filter((item) => item.done).length,
          checklist_total: card.checklist.length,
        })),
    };
  };

  function handle(call: Call): Response {
    const { method, url, body } = call;
    const path = url.pathname.replace('/api/v1', '');
    const parts = path.split('/').filter(Boolean);
    const [root, id, section, child, action] = parts;

    if (root === 'tasks') {
      if (id === undefined) {
        const open = server.tasks.filter((task) => task.completed_at === null);
        return json({ items: open, next_cursor: null });
      }
      const task = server.tasks.find((item) => item.id === id);
      return task ? json(task) : problem('not_found', 404);
    }
    if (root === 'links') {
      if (method === 'GET') {
        const entity = url.searchParams.get('entity_id');
        const items = server.links
          .filter((link) => link.source_id === entity || link.target_id === entity)
          .map((link) => ({
            ...link,
            linked_type: link.source_id === entity ? link.target_type : link.source_type,
            linked_id: link.source_id === entity ? link.target_id : link.source_id,
          }));
        return json({ items, next_cursor: null });
      }
      if (method === 'POST') {
        const exists = server.links.some(
          (link) => link.source_id === body.source_id && link.target_id === body.target_id,
        );
        if (exists) return problem('link_already_exists', 409);
        const created = { id: next_id('link'), ...body } as Link;
        server.links.push(created);
        return json(created, 201);
      }
      server.links = server.links.filter((link) => link.id !== id);
      return new Response(null, { status: 204 });
    }

    // /projects
    if (id === undefined) {
      if (method === 'POST') {
        const created = projectOf({
          id: next_id('p'),
          name: String(body.name),
          description: (body.description as string | null | undefined) ?? null,
          visibility: (body.visibility as Project['visibility'] | undefined) ?? 'personal',
        });
        server.projects.push(created);
        server.lanes.push(
          ...defaultLanes(created.id).map((lane) => ({ ...lane, id: `${created.id}-${lane.id}` })),
        );
        return json(view(created), 201);
      }
      const q = url.searchParams.get('q')?.toLowerCase();
      const visibility = url.searchParams.get('visibility');
      const items = server.projects
        .filter((project) => (q ? project.name.toLowerCase().includes(q) : true))
        .filter((project) => (visibility ? project.visibility === visibility : true))
        .map(view);
      return json({ items, next_cursor: null });
    }
    const project = server.projects.find((item) => item.id === id);
    if (!project) return problem('not_found', 404);

    if (section === undefined) {
      if (method === 'DELETE') {
        server.projects = server.projects.filter((item) => item.id !== id);
        return new Response(null, { status: 204 });
      }
      if (method === 'PATCH') Object.assign(project, body);
      return json(view(project));
    }
    if (section === 'summary') {
      return json(summary(id, url.searchParams.get('today') ?? '2026-03-01'));
    }
    if (section === 'lanes') {
      if (child === 'order') {
        const ids = body.lane_ids as string[];
        ids.forEach((lane_id, index) => {
          const lane = server.lanes.find((item) => item.id === lane_id);
          if (lane) lane.position = index;
        });
        return json({ items: lanes_of(id), next_cursor: null });
      }
      if (child === undefined) {
        if (method === 'POST') {
          const created = laneOf({
            id: next_id('l'),
            project_id: id,
            name: String(body.name),
            color: String(body.color),
            counts_as_done: body.counts_as_done === true,
            position: lanes_of(id).length,
          });
          server.lanes.push(created);
          return json(created, 201);
        }
        return json({ items: lanes_of(id), next_cursor: null });
      }
      const lane = server.lanes.find((item) => item.id === child);
      if (!lane) return problem('not_found', 404);
      if (method === 'PATCH') {
        Object.assign(lane, body);
        return json(lane);
      }
      if (method === 'DELETE') {
        if (lanes_of(id).length === 1) return problem('last_lane', 409);
        const target = url.searchParams.get('move_cards_to');
        const moving = cards_of(id).filter((card) => card.lane_id === lane.id);
        if (moving.length > 0 && !target) return problem('lane_has_cards', 409);
        moving.forEach((card) => {
          card.lane_id = String(target);
          card.position = 999;
        });
        server.lanes = server.lanes.filter((item) => item.id !== lane.id);
        lanes_of(id).forEach((item, index) => {
          item.position = index;
        });
        renumber(id);
        return new Response(null, { status: 204 });
      }
      return json(lane);
    }
    if (section === 'cards') {
      if (child === undefined) {
        if (method === 'POST') {
          const lane_id = String(body.lane_id);
          const created = cardOf({
            ...(body as Partial<Card>),
            id: next_id('c'),
            project_id: id,
            title: String(body.title),
            position: cards_of(id).filter((card) => card.lane_id === lane_id).length,
            checklist: (
              (body.checklist as { text: string; done: boolean }[] | undefined) ?? []
            ).map((item, index) => ({ id: next_id('i'), position: index, ...item })),
          });
          server.cards.push(created);
          return json(created, 201);
        }
        return json({ items: cards_of(id), next_cursor: null });
      }
      const card = server.cards.find((item) => item.id === child);
      if (!card) return problem('not_found', 404);
      if (action === 'move') {
        const lane_id = String(body.lane_id);
        const position = typeof body.position === 'number' ? body.position : 9999;
        const others = cards_of(id)
          .filter((item) => item.lane_id === lane_id && item.id !== card.id)
          .sort((a, b) => a.position - b.position);
        card.lane_id = lane_id;
        others.splice(Math.min(position, others.length), 0, card);
        others.forEach((item, index) => {
          item.position = index;
        });
        renumber(id);
        return json(card);
      }
      if (method === 'DELETE') {
        server.cards = server.cards.filter((item) => item.id !== card.id);
        return new Response(null, { status: 204 });
      }
      if (method === 'PATCH') {
        const { checklist, ...rest } = body as { checklist?: { text: string; done: boolean }[] };
        Object.assign(card, rest);
        if (checklist) {
          card.checklist = checklist.map((item, index) => ({
            id: next_id('i'),
            position: index,
            ...item,
          }));
        }
      }
      return json(card);
    }
    return problem('not_found', 404);
  }

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input, 'http://localhost');
      const method = init?.method ?? 'GET';
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      if (url.pathname === '/api/v1/me') {
        return Promise.resolve(json({ id: 'u-1', email: 'a@b.c' }));
      }
      const call = { method, url, body };
      server.calls.push(call);
      if (server.mode === 'loading') return new Promise<Response>(() => undefined);
      if (server.mode === 'error') return Promise.resolve(problem('boom', 500));
      const rejected = server.reject?.(call);
      if (rejected === 'hang') return new Promise<Response>(() => undefined);
      if (rejected) return Promise.resolve(rejected);
      return Promise.resolve(handle(call));
    }),
  );
  return server;
}

export function callsTo(server: Server, method: string, fragment: string): Call[] {
  return server.calls.filter(
    (call) => call.method === method && call.url.pathname.includes(fragment),
  );
}
