# Videomaker Role — Design Spec

## Summary

Add a new `videomaker` role that mirrors mentor access but without session assignment or the Registos page. Videomakers use the app to consult schedules, ongoing productions, chat, and contacts.

## Access Model

| Page | Videomaker | Mentor | Notes |
|------|-----------|--------|-------|
| Dashboard | ✅ simplified | ✅ | No session widgets |
| Horários | ✅ | ✅ | |
| Produção | ✅ | ✅ | |
| Tarefas | ✅ | ✅ | |
| Estúdio | ✅ | ✅ | |
| Registos | ❌ | ✅ | Explicitly excluded |
| Chat | ✅ | ✅ | |
| Equipa | ✅ | ✅ | |
| Wiki | ✅ | ✅ | |
| Material | ❌ | ❌ | Coord/Direção only |
| Estatísticas | ❌ | ❌ | Coord/Direção only |

## Data Model

- Videomakers **enter the `mentores` table** (auto-created via `/api/mentores/me`) — gives them location (morada/coordenadas) and presence in Equipa.
- `listar_mentores()` filters `perfil != 'videomaker'` → they never appear in session assignment dropdowns.
- `MENTOR_ROLES` includes `videomaker` for auto-create logic.
- `ROLES_VALIDOS` includes `videomaker` for the role-update endpoint.

## Backend Changes

- `main.py`: add `videomaker` to `MENTOR_ROLES` and `ROLES_VALIDOS`
- `services/turma_service.py`: `listar_mentores` query adds `AND perfil != 'videomaker'`

## Frontend Changes

- `types/index.ts`: add `'videomaker'` to `UserProfile`
- `Sidebar.tsx`: add `videomaker` to `allProfiles`; Registos item uses filtered profiles without videomaker
- `Dashboard.tsx`: `case 'videomaker'` → `<VideomakerDashboard />`
- New `VideomakerDashboard.tsx`: simplified view with quick-link cards (Horários, Produções, Chat)
- `Login.tsx`: add Videomaker option to role select
