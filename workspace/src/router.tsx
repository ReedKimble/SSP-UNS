import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from './AppLayout'
import EditorRoute from './routes/EditorRoute'
import TranslationRoute from './routes/TranslationRoute'
import AnalyzerRoute from './routes/AnalyzerRoute'
import AudioLabRoute from './routes/AudioLabRoute'
import UnsToolsRoute from './routes/UnsToolsRoute'
import HelpRoute from './routes/HelpRoute'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/workspace/editor" replace />,
  },
  {
    path: '/workspace',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/workspace/editor" replace /> },
      { path: 'editor', element: <EditorRoute /> },
      { path: 'translation', element: <TranslationRoute /> },
      { path: 'analyzer', element: <AnalyzerRoute /> },
      { path: 'audio', element: <AudioLabRoute /> },
      { path: 'uns-tools', element: <UnsToolsRoute /> },
      { path: 'help', element: <HelpRoute /> },
    ],
  },
], {
  basename: '/SSP-UNS',
})
