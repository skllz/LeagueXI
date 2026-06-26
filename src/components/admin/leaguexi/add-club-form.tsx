"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { addTrackedClub } from "@/app/actions/admin-leaguexi"

export function AddClubForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [shortName, setShortName] = useState("")
  const [country, setCountry] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await addTrackedClub({ name, shortName, country })
    setLoading(false)
    if (result.error) {
      alert(result.error)
      return
    }
    setName("")
    setShortName("")
    setCountry("")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Club name"
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        required
      />
      <input
        value={shortName}
        onChange={(e) => setShortName(e.target.value)}
        placeholder="ABBR"
        maxLength={5}
        className="w-24 px-3 py-1.5 text-sm border border-border rounded-md bg-background uppercase"
        required
      />
      <input
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        placeholder="Country"
        className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="px-3 py-1.5 text-sm font-medium rounded-md bg-foreground text-background disabled:opacity-40"
      >
        {loading ? "Adding…" : "Add club"}
      </button>
    </form>
  )
}
