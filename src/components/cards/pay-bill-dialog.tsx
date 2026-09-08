"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useFinanceData } from "@/components/finance/finance-provider"
import type { CardData } from "@/data/seed"
import { Loader2Icon } from "lucide-react"

export function PayBillDialog({ open, onOpenChange, card }: { open: boolean; onOpenChange: (open: boolean) => void; card: CardData }) {
  const { bankAccounts, refresh } = useFinanceData()
  const [accountId, setAccountId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const amount = card.monthlySpend || 0

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (amount <= 0) return

    setLoading(true)
    setError("")

    try {
      const year = new Date().getUTCFullYear()
      const month = String(new Date().getUTCMonth() + 1).padStart(2, '0')
      const day = String(new Date().getUTCDate()).padStart(2, '0')
      
      const payload = {
        date: `${year}-${month}-${day}`,
        payee: `Pagamento Fatura ${card.name}`,
        category: "Transferência",
        accountId: accountId,
        destinationAccountId: card.id,
        amount: amount,
        type: "transfer",
        status: "completed",
        sourceType: "account"
      }

      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Erro na API")
      }

      await refresh()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar Fatura</DialogTitle>
          <DialogDescription>
            A fatura atual do cartão {card.name} está em {new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(amount)}.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Pagar usando qual conta?
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="" disabled>Selecione uma conta corrente</option>
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(acc.balance)})</option>
              ))}
            </select>
          </label>
          
          {error && <p className="text-sm text-destructive">{error}</p>}
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || amount <= 0 || !accountId}>
              {loading && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              Pagar Fatura
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
