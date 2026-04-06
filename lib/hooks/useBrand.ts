'use client'

import { useState, useEffect, useCallback } from 'react'
import { getBrands, getSelectedBrandId, setSelectedBrandId } from '@/lib/storage'
import type { Brand } from '@/lib/types'

/**
 * Global brand hook — reacts to sidebar brand picker.
 * Use in every page that needs the active brand.
 * 
 * const { brand, brands, selectBrand } = useBrand()
 */
export function useBrand() {
  const [brand,  setBrand]  = useState<Brand | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])

  const load = useCallback(() => {
    const all        = getBrands()
    const selectedId = getSelectedBrandId()
    const found      = all.find(b => b.id === selectedId) ?? all[0] ?? null
    setBrands(all)
    setBrand(found)
    // If nothing was selected yet, persist the first brand
    if (!selectedId && found) setSelectedBrandId(found.id)
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('brandChanged', load)
    return () => window.removeEventListener('brandChanged', load)
  }, [load])

  function selectBrand(id: string) {
    setSelectedBrandId(id)
    const found = getBrands().find(b => b.id === id) ?? null
    setBrand(found)
    window.dispatchEvent(new CustomEvent('brandChanged', { detail: { brand_id: id } }))
  }

  return { brand, brands, selectBrand }
}
