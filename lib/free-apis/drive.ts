/**
 * Google Drive public folder → list image files
 * Requires GOOGLE_API_KEY (same key as YouTube Data API v3)
 * Folder must be shared as "Anyone with the link can view"
 */

export interface DriveImageFile {
  id:           string
  name:         string
  mimeType:     string
  thumbnailLink?: string
  viewUrl:      string   // direct view URL for the browser
  openaiUrl:    string   // URL OpenAI vision can fetch
}

function extractFolderId(url: string): string | null {
  // https://drive.google.com/drive/folders/FOLDER_ID
  // https://drive.google.com/drive/u/0/folders/FOLDER_ID
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

export async function listDriveFolderImages(folderUrl: string): Promise<DriveImageFile[]> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    console.warn('[Drive] GOOGLE_API_KEY not set')
    return []
  }

  const folderId = extractFolderId(folderUrl)
  if (!folderId) return []

  try {
    const query = encodeURIComponent(`'${folderId}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf') and trashed = false`)
    const fields = encodeURIComponent('files(id,name,mimeType,thumbnailLink)')
    const url    = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&key=${apiKey}&pageSize=50`

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      console.error('[Drive] API error', res.status)
      return []
    }

    const data = await res.json() as {
      files: { id: string; name: string; mimeType: string; thumbnailLink?: string }[]
    }

    return (data.files ?? []).map(f => ({
      id:           f.id,
      name:         f.name,
      mimeType:     f.mimeType,
      thumbnailLink: f.thumbnailLink,
      viewUrl:      `https://drive.google.com/uc?export=view&id=${f.id}`,
      openaiUrl:    `https://lh3.googleusercontent.com/d/${f.id}`,
    }))
  } catch (err) {
    console.error('[Drive] Error listing folder:', err)
    return []
  }
}
