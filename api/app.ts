/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDatabase } from './db/database.js'
import { createTables as createSchemaTables, seedData as seedSchemaData } from './db/schema.js'

import authRoutes from './routes/auth.js'
import petsRoutes from './routes/pets.js'
import storesRoutes from './routes/stores.js'
import appointmentsRoutes from './routes/appointments.js'
import medicalRoutes from './routes/medical.js'
import pharmacyRoutes from './routes/pharmacy.js'
import paymentsRoutes from './routes/payments.js'
import complaintsRoutes from './routes/complaints.js'
import messagesRoutes from './routes/messages.js'
import reportsRoutes from './routes/reports.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

async function initializeApp() {
  try {
    console.log('正在初始化数据库...')
    await initDatabase()
    console.log('数据库连接成功')

    console.log('正在创建数据表...')
    createSchemaTables()
    console.log('数据表创建完成')

    console.log('正在初始化数据...')
    seedSchemaData()
    console.log('数据初始化完成')

    console.log('后端服务初始化完成')
  } catch (error) {
    console.error('初始化失败:', error)
    process.exit(1)
  }
}

initializeApp()

app.use('/api/auth', authRoutes)
app.use('/api/pets', petsRoutes)
app.use('/api/stores', storesRoutes)
app.use('/api/appointments', appointmentsRoutes)
app.use('/api/medical', medicalRoutes)
app.use('/api/pharmacy', pharmacyRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/complaints', complaintsRoutes)
app.use('/api/messages', messagesRoutes)
app.use('/api/reports', reportsRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('服务器错误:', error)
  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
