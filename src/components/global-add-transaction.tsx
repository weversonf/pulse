"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog"
import { useFinanceData } from "@/components/finance/finance-provider"

export function GlobalAddTransaction() {
  const [open, setOpen] = useState(false)
  const { refresh } = useFinanceData()

  return (
    <>
      <Button 
        size="sm" 
        onClick={() => setOpen(true)} 
        className="h-8 gap-1.5 px-3 bg-primary text-primary-foreground shadow hover:bg-primary/90"
      >
        <PlusIcon className="size-3.5" />
        <span className="hidden sm:inline">Nova Transação</span>
        <span className="inline sm:hidden">Nova</span>
      </Button>

      <AddTransactionDialog 
        open={open} 
        onOpenChange={setOpen} 
        onSaved={refresh} 
      />
    </>
  )
}
