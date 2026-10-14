/**
 * 上传背景图片的本地存放（IndexedDB，纯 I/O）。
 * ⚠️ 不用 localStorage：5MB 图转 base64 ≈6.7MB 必超配额、连带拖坏看板数据；IndexedDB 存 Blob、配额按磁盘算。
 * 图片本体不属于外观偏好（偏好只记文件名与大小），不进 localStorage 也不进备份；备份导入不碰上传图（./store.ts 的 `importAppearance`）。
 * 逐主题一份（键 `background:<主题键>`），改/删 A 主题不动 B 主题；「恢复默认」连图一起删（走 `resetThemeAppearance`，别直接调 store 的 `resetThemeProfile`）。
 * ⚠️ 所有异常只控制台告警并回退：隐私模式 / 禁用存储会直接抛，背景功能静默失效，不能影响应用启动。
 */
import { THEME_KEYS } from '../theme-preference.ts'
import { getAppearance, getThemeImageUrl, resetThemeProfile, setThemeImageUrl } from './store.ts'
import type { ThemeKey } from '../theme-preference.ts'

const DB_NAME = 'ffxiv-dash'
const DB_VERSION = 1
const STORE_NAME = 'assets'

/** 某套主题上传图的存储键。 */
function imageKey(key: ThemeKey): string {
  return `background:${key}`
}

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
 * 写入某套主题上传的图片，并接到外观快照上（这套主题上一个 object URL 会被 revoke，别的主题不受影响）。
 * 返回是否成功，失败由调用方提示用户。
 */
export function putBackgroundImage(key: ThemeKey, file: Blob): Promise<boolean> {
  return runTransaction('readwrite', (store) => store.put(file, imageKey(key))).then((result) => {
    if (result === null) {
      return false
    }
    setThemeImageUrl(key, URL.createObjectURL(file))
    return true
  })
}

/**
 * 删除**某套主题**已保存的图片。
 * 即使删除失败也要把快照上这套主题的 URL 摘掉，避免继续显示一张已经不存在的图。
 */
export function clearBackgroundImage(key: ThemeKey): Promise<void> {
  return runTransaction('readwrite', (store) => store.delete(imageKey(key))).then(() => {
    setThemeImageUrl(key, null)
  })
}

/**
 * 启动时把各主题已保存的图片读回内存并套到背景上。
 * 首屏只等 localStorage（颜色/外链立刻可见），上传图晚一两帧出现，因此不要 await，跑完自己通知订阅者。
 */
export function initAppearanceImage(): void {
  const { profiles } = getAppearance()
  for (const key of THEME_KEYS) {
    // 没有文件名 = 这套主题没上传过图，省下这次 I/O
    if (!profiles[key]?.imageName) {
      continue
    }
    void runTransaction<Blob>('readonly', (store) => store.get(imageKey(key))).then((blob) => {
      if (blob) {
        setThemeImageUrl(key, URL.createObjectURL(blob))
      }
    })
  }
}

/**
 * 「恢复默认」入口：清掉某套主题全部改动（回出厂背景）并删掉它上传的图。
 * 全仓唯一同时碰外观 store 与 IndexedDB 的动作，所以住在这里——`store.ts` 纯逻辑，不反向依赖 IndexedDB。
 * ⚠️ 顺序是「先同步清档案、再后台删图」：界面立刻回出厂外观，不被 IndexedDB 往返拖住；删图失败只留无引用数据。
 */
export function resetThemeAppearance(key: ThemeKey): void {
  const previous = getThemeImageUrl(key)
  resetThemeProfile(key)

  void runTransaction('readwrite', (store) => store.delete(imageKey(key))).then(() => {
    // 删除期间用户可能又给这套主题传了新图（那时快照上已经不是 `previous` 了）：别把新的抹了
    if (previous !== null && getThemeImageUrl(key) === previous) {
      setThemeImageUrl(key, null)
    }
  })
}
