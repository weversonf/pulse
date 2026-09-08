"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "../lib/firebase/admin";
import { requireSessionUser } from "../lib/auth/session";
import { transactionInputSchema, type TransactionInput } from "../lib/finance/schemas";
import { createHash } from "crypto";

export type ImportTransactionRow = {
  date?: string;
  payee?: string;
  description?: string;
  category?: string;
  accountId?: string;
  account?: string;
  amount?: number | string;
  type?: string;
  notes?: string;
};

function timestamp() {
  return new Date().toISOString();
}

function guessCategory(payee: string, originalCategory?: string): string {
  if (originalCategory && originalCategory.trim().toLowerCase() !== "outros") return originalCategory.trim().slice(0, 80);
  
  const text = payee.toLowerCase();
  
  const foodKeywords = ["ifood", "uber eats", "rappi", "mcdonalds", "burger king", "restaurante", "padaria", "supermercado", "mercado", "carrefour", "pão de açúcar", "atacadao", "assai", "extra"];
  if (foodKeywords.some(k => text.includes(k))) return "Alimentação";

  const transportKeywords = ["uber", "99", "cabify", "posto", "gasolina", "estacionamento", "pedágio", "concessionaria", "oficina"];
  if (transportKeywords.some(k => text.includes(k))) return "Transporte";
  
  const homeKeywords = ["conta de luz", "enel", "sabesp", "copasa", "energia", "água", "internet", "claro", "vivo", "tim", "aluguel", "condominio"];
  if (homeKeywords.some(k => text.includes(k))) return "Moradia";
  
  const healthKeywords = ["farmácia", "drogaria", "pague menos", "drogasil", "raia", "hospital", "clínica", "médico", "dentista", "unimed", "amil"];
  if (healthKeywords.some(k => text.includes(k))) return "Saúde";

  const entertainmentKeywords = ["netflix", "spotify", "amazon prime", "hbo", "disney", "cinema", "ingresso", "sympla"];
  if (entertainmentKeywords.some(k => text.includes(k))) return "Lazer";

  const educationKeywords = ["faculdade", "universidade", "escola", "colegio", "curso", "udemy", "alura"];
  if (educationKeywords.some(k => text.includes(k))) return "Educação";

  return "Outros";
}


/**
 * Retorna o valor numérico preservando o sinal (negativo = débito).
 * O Math.abs() só é aplicado na gravação, não aqui.
 */
function normalizeAmountRaw(value: unknown): number {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim().replace(/R\$\s?/gi, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Detecta o tipo da transação a partir da coluna "type" (se disponível) ou pelo sinal do valor.
 * Valores negativos → expense; positivos → income; neutro sem contexto → expense.
 */
function normalizeType(value: unknown, rawAmount: number): TransactionInput["type"] {
  const text = String(value ?? "").toLocaleLowerCase("pt-BR");
  if (text.includes("transfer") || text.includes("transf")) return "transfer";
  if (text.includes("income") || text.includes("receit") || text.includes("entrada") || text.includes("crédit")) return "income";
  if (text.includes("expense") || text.includes("despesa") || text.includes("débito") || text.includes("debit")) return "expense";
  // Se não há campo "type", usar o sinal do valor bruto (negativo = saída)
  if (rawAmount > 0) return "income";
  return "expense";
}

function normalizeDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const br = text.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return new Date().toISOString().slice(0, 10);
}

/**
 * Gera um ID determinístico para a transação com base nos campos que a identificam unicamente.
 * Isso torna a importação idempotente: reimportar o mesmo extrato não cria duplicatas.
 */
function importHash(ownerId: string, date: string, payee: string, amount: number, accountId: string): string {
  const raw = `${ownerId}|${date}|${payee.toLowerCase().trim()}|${amount.toFixed(2)}|${accountId}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

export async function importTransactions(rows: ImportTransactionRow[]) {
  const user = await requireSessionUser();
  if (!Array.isArray(rows) || rows.length === 0) return { imported: 0, errors: ["Nenhum lançamento encontrado."] };
  if (rows.length > 500) throw new Error("Importe no máximo 500 lançamentos por vez.");

  const db = getAdminFirestore();
  const errors: string[] = [];
  let imported = 0;

  // Processar em batches de 400 (limite Firestore = 500 ops)
  const BATCH_SIZE = 400;
  const chunks = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    chunks.push(rows.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    // Mapa para acumular deltas de saldo por conta neste chunk
    const balanceDeltas = new Map<string, number>();

    for (const [index, row] of chunk.entries()) {
      const rawAmount = normalizeAmountRaw(row.amount);
      const amount = Math.abs(rawAmount); // sempre positivo para armazenar
      const txType = normalizeType(row.type, rawAmount);
      const date = normalizeDate(row.date);
      const payee = String(row.payee ?? row.description ?? "Lançamento importado").trim().slice(0, 120);
      const accountId = String(row.accountId ?? row.account ?? "").trim().slice(0, 120);

      if (!accountId) {
        errors.push(`Linha ${index + 1}: accountId obrigatório.`);
        continue;
      }
      const candidate = {
        date,
        payee,
        category: guessCategory(payee, row.category),
        accountId,
        amount,
        type: txType,
        status: "completed" as const,
        sourceType: "account" as const,
        notes: String(row.notes ?? "Importado por CSV/OFX").trim().slice(0, 1000),
      };


      const parsed = transactionInputSchema.safeParse(candidate);
      if (!parsed.success) {
        errors.push(`Linha ${index + 1}: dados incompletos ou inválidos.`);
        continue;
      }

      // Acumula delta de saldo: receita soma, despesa subtrai
      if (txType === "income" || txType === "expense") {
        const delta = txType === "income" ? amount : -amount;
        balanceDeltas.set(accountId, (balanceDeltas.get(accountId) ?? 0) + delta);
      }

      // Usa hash determinístico como ID: reimportar é idempotente
      const docId = importHash(user.uid, date, payee, amount, accountId);
      const reference = db.collection("transactions").doc(docId);
      batch.set(reference, { ...parsed.data, ownerId: user.uid, importSource: "csv-or-ofx", createdAt: timestamp(), updatedAt: timestamp() }, { merge: false });
      imported += 1;
    }

    // Atualizar saldos das contas afetadas neste chunk
    // Usamos db.runTransaction para garantir consistência de saldo
    if (balanceDeltas.size > 0) {
      await db.runTransaction(async (txn) => {
        // Fase 1: leituras
        const accountSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>();
        for (const accountId of balanceDeltas.keys()) {
          const ref = db.collection("accounts").doc(accountId);
          const snap = await txn.get(ref);
          accountSnaps.set(accountId, snap);
        }
        // Fase 2: escritas
        for (const [accountId, delta] of balanceDeltas.entries()) {
          const snap = accountSnaps.get(accountId);
          if (snap?.exists && (snap.data()?.ownerId === user.uid || snap.data()?.uid === user.uid)) {
            const currentBalance = Number(snap.data()?.balance ?? 0);
            txn.update(snap.ref, { balance: Number((currentBalance + delta).toFixed(2)), updatedAt: timestamp() });
          }
        }
      });
    }

    if (imported > 0) await batch.commit();
  }

  revalidatePath("/");
  return { imported, errors };
}
