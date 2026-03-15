type ErrorPayload = {
  error?: string
}

function hasErrorMessage(value: unknown): value is ErrorPayload {
  return typeof value === "object" && value !== null && typeof (value as ErrorPayload).error === "string"
}

export async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const bodyText = await response.text()
  let data: unknown = null

  if (bodyText) {
    try {
      data = JSON.parse(bodyText)
    } catch {
      const trimmed = bodyText.trim().toLowerCase()
      const isHtml = trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")
      const detail = isHtml
        ? "Server returned HTML instead of JSON. Check API route/server logs."
        : "Server returned invalid JSON."
      throw new Error(`${fallbackMessage}. ${detail}`)
    }
  }

  if (!response.ok) {
    if (hasErrorMessage(data) && data.error) {
      throw new Error(data.error)
    }
    throw new Error(fallbackMessage)
  }

  return data as T
}