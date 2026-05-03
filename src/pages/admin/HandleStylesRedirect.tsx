/**
 * Redirect dalle vecchie route handles / handle-presets / handle-textures
 * verso la nuova pagina unificata /admin/handle-styles con il tab giusto.
 */
import { Navigate } from 'react-router-dom';

export const HandlePresetsRedirect = () => (
  <Navigate to="/admin/handle-styles?tab=presets" replace />
);

export const HandleTexturesRedirect = () => (
  <Navigate to="/admin/handle-styles?tab=textures" replace />
);

export const HandlesRedirect = () => (
  <Navigate to="/admin/handle-styles?tab=types" replace />
);
