"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useFinanceData } from "@/components/finance/finance-provider"

export function AddTransactionDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> | void }) {
  const { bankAccounts, cardsData } = useFinanceData()
  const [payee, setPayee] = useState("")
  const [category, setCategory] = useState("Geral")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setValor] = useState("")
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense")
  const [accountId, setAccountId] = useState("")
  const [destinationAccountId, setDestinationAccountId] = useState("")
  const [status, setStatus] = useState<"planned" | "completed">("completed")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const [recurrence, setRecurrence] = useState<"unica" | "parcelada" | "fixa">("unica")
  const [installments, setInstallments] = useState(2)
  const [months, setMonths] = useState(12)

  useEffect(() => {
    if (open) {
      setPayee("")
      setCategory("Geral")
      setDate(new Date().toISOString().slice(0, 10))
      setValor("")
      setType("expense")
      setAccountId(bankAccounts[0]?.id || "")
      setDestinationAccountId("")
      setStatus("completed")
      setNotes("")
      setError("")
      setRecurrence("unica")
      setInstallments(2)
      setMonths(12)
    }
  }, [open, bankAccounts])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const numericAmount = Number(amount.replace(",", "."))
      if (isNaN(numericAmount) || numericAmount <= 0) throw new Error("Valor inválido.")
      if (!accountId) throw new Error("Selecione uma conta.")
      if (type === "transfer" && (!destinationAccountId || accountId === destinationAccountId)) throw new Error("Selecione uma conta de destino diferente da origem.")

      const isInstallment = recurrence === "parcelada"
      const isFixed = recurrence === "fixa"
      const count = isInstallment ? installments : isFixed ? months : 1
      
      const promises = []
      let currentDate = new Date(date)

      const isCreditCard = cardsData.some(c => c.id === accountId)

      for (let i = 0; i < count; i++) {
        // Formata data YYYY-MM-DD
        const year = currentDate.getUTCFullYear()
        const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0')
        const day = String(currentDate.getUTCDate()).padStart(2, '0')
        const formattedDate = `${year}-${month}-${day}`

        const title = isInstallment ? `${payee} (${i + 1}/${count})` : payee

        const payload = {
          date: formattedDate,
          payee: title,
          category,
          accountId,
          destinationAccountId: type === "transfer" ? destinationAccountId : undefined,
          amount: numericAmount, // Assume que o valor digitado é o valor da parcela ou valor fixo
          type,
          status: i === 0 ? status : "planned", // As próximas sempre caem como planejadas
          sourceType: isCreditCard ? "credit-card" : "account",
          notes: notes || undefined
        }

        promises.push(
          fetch(`/api/finance/transactions`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(payload) 
          })
        )

        // Adiciona 1 mês para a próxima
        currentDate.setUTCMonth(currentDate.getUTCMonth() + 1)
      }
      
      const responses = await Promise.all(promises)
      for (const res of responses) {
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Não foi possível salvar todas as transações.")
        }
      }

      await onSaved()
      onOpenChange(false)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Não foi possível salvar a transação.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova transação</DialogTitle>
          <DialogDescription>Adicione um novo lançamento manual.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            Descrição
            <Input value={payee} onChange={(event) => setPayee(event.target.value)} required placeholder="Ex: Mercado, Salário..." />
          </label>
          
          <label className="grid gap-1.5 text-sm font-medium">
            Tipo
            <select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="expense">Despesa</option>
              <option value="income">Entrada</option>
              <option value="transfer">Transferência</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Valor
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(event) => setValor(event.target.value)} required placeholder="0,00" />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Conta {type === "transfer" ? "de Origem" : ""}
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="" disabled>Selecione...</option>
              <optgroup label="Contas Bancárias">
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(acc.balance)})</option>
                ))}
              </optgroup>
              <optgroup label="Cartões de Crédito">
                {cardsData.map(card => (
                  <option key={card.id} value={card.id}>{card.name} (Crédito)</option>
                ))}
              </optgroup>
            </select>
          </label>

          {type === "transfer" ? (
            <label className="grid gap-1.5 text-sm font-medium">
              Conta de Destino
              <select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} required className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="" disabled>Selecione...</option>
                <optgroup label="Contas Bancárias">
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id} disabled={acc.id === accountId}>{acc.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>
          ) : (
            <label className="grid gap-1.5 text-sm font-medium">
              Categoria
              <Input value={category} onChange={(event) => setCategory(event.target.value)} required />
            </label>
          )}

          <label className="grid gap-1.5 text-sm font-medium">
            Data
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="completed">Concluída</option>
              <option value="planned">Planejada</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            Observações
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          <div className="grid gap-2 sm:col-span-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Repetição / Recorrência</p>
            <div className="flex flex-wrap gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="recurrence" checked={recurrence === "unica"} onChange={() => setRecurrence("unica")} className="accent-primary" />
                <span>Única</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="recurrence" checked={recurrence === "fixa"} onChange={() => setRecurrence("fixa")} className="accent-primary" />
                <span>Fixa (Mensal)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="recurrence" checked={recurrence === "parcelada"} onChange={() => setRecurrence("parcelada")} className="accent-primary" />
                <span>Parcelada</span>
              </label>
            </div>
            
            {recurrence === "fixa" && (
              <label className="grid gap-1.5 text-sm font-medium mt-2">
                Gerar para quantos meses?
                <Input type="number" min="2" max="120" value={months} onChange={(e) => setMonths(Number(e.target.value))} />
              </label>
            )}
            {recurrence === "parcelada" && (
              <label className="grid gap-1.5 text-sm font-medium mt-2">
                Quantidade de parcelas
                <Input type="number" min="2" max="120" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} />
                <span className="text-xs text-muted-foreground mt-1">
                  O valor digitado lá em cima será o valor de CADA parcela (ex: se digitar R$ 100 e 5 parcelas, serão geradas 5 transações de R$ 100).
                </span>
              </label>
            )}
          </div>

          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
