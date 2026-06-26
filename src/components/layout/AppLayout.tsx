import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { motion } from 'framer-motion'

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </motion.main>
    </div>
  )
}
