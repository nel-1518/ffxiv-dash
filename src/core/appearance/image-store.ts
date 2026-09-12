/**
 * 上传背景图片的本地存放（IndexedDB，纯 I/O）。
 *
 * 为什么不用 localStorage：5MB 的图片转成 base64 约 6.7MB，而 localStorage
 * 通常只有 5MB 配额，写进去必然抛 QuotaExceededError，还会连带把看板数据一起拖坏。
 * IndexedDB 能直接存 Blob 二进制、配额按磁盘可用空间算，是这里的正解。
 *
 * 图片本体**不属于外观偏好**（偏好里只记文件名与大小）：因此它既不会进
 * localStorage，也不会出现在导出的看板数据里。
 *
 * 所有异常都只在控制台告警并回退 —— 隐私模式 / 禁用存储下浏览器会直接抛，
 * 那时背景功能静默失效即可，不能影响应用启动。
 */
import { getAppearance, setImageUrl } from './store.ts'

const DB_NAME = 'ffxiv-dash'
const DB_VERSION = 1
const STORE_NAME = 'assets'
const BACKGROUND_KEY = 'background'

/** 打开数据库的 Promise 做模块级缓存：一次会话只开一次连接。 */
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (error) {
      console.warn('[ffxiv-dash] 无法打开 IndexedDB，背景图片功能不可用', error)
      resolve(null)
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.warn('[ffxiv-dash] 打开 IndexedDB 失败，背景图片功能不可用', request.error)
      resolve(null)
    }
  })

  return dbPromise
}

/** 把一次事务包成 Promise；失败只告警并返回 null。 */
function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null)
          return
        }
        try {
          const transaction = db.transaction(STORE_NAME, mode)
          const request = work(transaction.objectStore(STORE_NAME))
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => {
            console.warn('[ffxiv-dash] 背景图片读写失败', request.error)
            resolve(null)
          }
          transaction.onabort = () => {
            console.warn('[ffxiv-dash] 背景图片事务被中止', transaction.error)
            resolve(null)
          }
        } catch (error) {
          console.warn('[ffxiv-dash] 背景图片操作异常', error)
          resolve(null)
        }
      }),
  )
}

/**
 * 写入上传的图片，并把它接到外观快照上（新的 object URL 会 revoke 上一个）。
 * 返回是否成功，失败由调用方提示用户。
 */
export function putBackgroundImage(file: Blob): Promise<boolean> {
  return runTransaction('readwrite', (store) => store.put(file, BACKGROUND_KEY)).then((result) => {
    if (result === null) {
      return false
    }
    setImageUrl(URL.createObjectURL(file))
    return true
  })
}

/** 删除已保存的图片。即使删除失败也要把快照上的 URL 摘掉，避免继续显示一张已经不存在的图。 */
export function clearBackgroundImage(): Promise<void> {
  return runTransaction('readwrite', (store) => store.delete(BACKGROUND_KEY)).then(() => {
    setImageUrl(null)
  })
}

/**
 * 启动时把已保存的图片读回内存并套到背景上。
 *
 * 首屏只等 localStorage（颜色/外链立刻可见），上传的图片晚一两帧才出现，
 * 因此这个函数**不要 await**，让它自己跑完通知订阅者即可。
 */
export function initAppearanceImage(): void {
  // 只有上传模式才需要去读库，其余模式省下这次 I/O
  if (getAppearance().source !== 'upload') {
    return
  }
  void runTransaction<Blob>('readonly', (store) => store.get(BACKGROUND_KEY)).then((blob) => {
    if (blob) {
      setImageUrl(URL.createObjectURL(blob))
    }
  })
}
