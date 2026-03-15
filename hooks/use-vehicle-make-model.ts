"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "@/components/ui/notify"

interface UseVehicleMakeModelOptions {
  onMakeChange?: (make: string) => void
  onModelChange?: (model: string) => void
}

export function useVehicleMakeModel(options?: UseVehicleMakeModelOptions) {
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<{ id: string; model: string; category: string }[]>([])
  const [loadingMakes, setLoadingMakes] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // Fetch all makes on mount
  useEffect(() => {
    fetchMakes()
  }, [])

  const fetchMakes = useCallback(async (search?: string) => {
    try {
      setLoadingMakes(true)
      const params = new URLSearchParams()
      if (search) params.append("search", search)

      const response = await fetch(`/api/vehicle-makes-models?${params}`)
      if (!response.ok) throw new Error("Failed to fetch makes")

      const data = await response.json()
      setMakes(data)
    } catch (error) {
      console.error("Error fetching makes:", error)
      toast.error("Failed to load vehicle makes")
    } finally {
      setLoadingMakes(false)
    }
  }, [])

  const fetchModels = useCallback(async (make: string, search?: string) => {
    if (!make) {
      setModels([])
      return
    }

    try {
      setLoadingModels(true)
      const params = new URLSearchParams({ make })
      if (search) params.append("search", search)

      const response = await fetch(`/api/vehicle-makes-models?${params}`)
      if (!response.ok) throw new Error("Failed to fetch models")

      const data = await response.json()
      setModels(data)
    } catch (error) {
      console.error("Error fetching models:", error)
      toast.error("Failed to load vehicle models")
    } finally {
      setLoadingModels(false)
    }
  }, [])

  const checkMakeExists = useCallback(
    (make: string) => {
      return makes.some(
        (m) => m.toLowerCase() === make.toLowerCase()
      )
    },
    [makes]
  )

  const checkModelExists = useCallback(
    (model: string) => {
      return models.some(
        (m) => m.model.toLowerCase() === model.toLowerCase()
      )
    },
    [models]
  )

  const saveMakeModel = useCallback(
    async (make: string, model: string, category: string = "Car") => {
      try {
        const response = await fetch("/api/vehicle-makes-models", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ make, model, category }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to save make/model")
        }

        const newEntry = await response.json()
        
        // Refresh makes and models
        await fetchMakes()
        if (make) {
          await fetchModels(make)
        }

        toast.success("New vehicle make/model saved successfully")
        return newEntry
      } catch (error) {
        console.error("Error saving make/model:", error)
        toast.error(
          error instanceof Error ? error.message : "Failed to save make/model"
        )
        throw error
      }
    },
    [fetchMakes, fetchModels]
  )

  return {
    makes,
    models,
    loadingMakes,
    loadingModels,
    fetchMakes,
    fetchModels,
    checkMakeExists,
    checkModelExists,
    saveMakeModel,
  }
}
