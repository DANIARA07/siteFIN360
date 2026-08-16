import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  type Auth,
} from 'firebase/auth'

const readEnv = (name: keyof ImportMetaEnv) => String(import.meta.env[name] ?? '').trim()

const config = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
}

const requiredConfig = {
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_APP_ID: config.appId,
}

export const missingFirebaseVariables = Object.entries(requiredConfig)
  .filter(([, value]) => !value)
  .map(([name]) => name)

export const firebaseConfigured = missingFirebaseVariables.length === 0

let appInstance: FirebaseApp | null = null
let authInstance: Auth | null = null
let initializationError = ''

if (firebaseConfigured) {
  try {
    appInstance = getApps().length ? getApp() : initializeApp(config)
    authInstance = getAuth(appInstance)
  } catch (error) {
    initializationError = error instanceof Error ? error.message : String(error)
  }
}

export const firebaseApp = appInstance
export const auth = authInstance
export const firebaseInitializationError = initializationError

let persistenceReady: Promise<void> | null = null

/**
 * Prepara a persistência com fallback para navegadores que bloqueiam localStorage,
 * especialmente Safari/iPhone e navegação privada.
 */
export function prepareAuthPersistence(): Promise<void> {
  if (!auth) return Promise.resolve()
  if (persistenceReady) return persistenceReady

  persistenceReady = setPersistence(auth, browserLocalPersistence)
    .catch(() => setPersistence(auth!, browserSessionPersistence))
    .catch(() => setPersistence(auth!, inMemoryPersistence))
    .then(() => undefined)

  return persistenceReady
}

export function firebaseEnvironmentSummary() {
  return {
    configured: firebaseConfigured,
    initialized: Boolean(auth),
    projectId: config.projectId,
    authDomain: config.authDomain,
    currentDomain: typeof window === 'undefined' ? '' : window.location.hostname,
    initializationError,
  }
}
