import { supabase } from "@/integrations/supabase/client";
import logger from '@/utils/logger';

export interface PendingTransaction {
  id: string;
  status: string;
  book_id: string;
}

export const checkUserCanBorrow = async (userId: string): Promise<{ canBorrow: boolean; pendingTransactions: PendingTransaction[] }> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, status, book_id')
      .eq('borrower_id', userId)
      .in('status', ['requested', 'in_progress']);

    if (error) {
      logger.error('Error checking user borrow eligibility:', error);
      return { canBorrow: true, pendingTransactions: [] }; // Allow borrowing if check fails
    }

    const pendingTransactions = data || [];
    const canBorrow = pendingTransactions.length === 0;

    return { canBorrow, pendingTransactions };
  } catch (error) {
    logger.error('Error:', error);
    return { canBorrow: true, pendingTransactions: [] }; // Allow borrowing if check fails
  }
};