import { supabase } from '@/integrations/supabase/client';
import logger from '@/utils/logger';

export interface BookFilters {
  status?: string;
  category?: string;
  searchQuery?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface BookInput {
  title: string;
  author: string;
  isbn?: string;
  cover_image?: string;
  description?: string;
  status: 'available' | 'sold' | 'rented';
  price?: number;
  rental_fee?: number;
  deposit?: number;
  user_id: string;
}

class BookService {
  static async getBooks(filters?: BookFilters) {
    try {
      let query = supabase
        .from('books')
        .select(`
          *,
          profiles!user_id (
            display_name,
            address
          )
        `);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.searchQuery) {
        query = query.or(`title.ilike.%${filters.searchQuery}%,author.ilike.%${filters.searchQuery}%`);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch books', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('BookService.getBooks error', error);
      throw error;
    }
  }

  static async getBookById(id: string) {
    try {
      const { data, error } = await supabase
        .from('books')
        .select(`
          *,
          profiles!user_id (
            display_name,
            address,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Failed to fetch book by id', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('BookService.getBookById error', error);
      throw error;
    }
  }

  static async createBook(book: BookInput) {
    try {
      const { data, error } = await supabase
        .from('books')
        .insert([book])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create book', error);
        throw error;
      }

      logger.info('Book created successfully', { bookId: data.id });
      return data;
    } catch (error) {
      logger.error('BookService.createBook error', error);
      throw error;
    }
  }

  static async updateBook(id: string, updates: Partial<BookInput>) {
    try {
      const { data, error } = await supabase
        .from('books')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update book', error);
        throw error;
      }

      logger.info('Book updated successfully', { bookId: id });
      return data;
    } catch (error) {
      logger.error('BookService.updateBook error', error);
      throw error;
    }
  }

  static async deleteBook(id: string) {
    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Failed to delete book', error);
        throw error;
      }

      logger.info('Book deleted successfully', { bookId: id });
      return true;
    } catch (error) {
      logger.error('BookService.deleteBook error', error);
      throw error;
    }
  }

  static async uploadBookCover(file: File, userId: string): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `book-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(filePath, file);

      if (uploadError) {
        logger.error('Failed to upload book cover', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('book-covers')
        .getPublicUrl(filePath);

      logger.info('Book cover uploaded successfully', { filePath });
      return data.publicUrl;
    } catch (error) {
      logger.error('BookService.uploadBookCover error', error);
      throw error;
    }
  }

  static async getBookCount(filters?: BookFilters): Promise<number> {
    try {
      let query = supabase
        .from('books')
        .select('*', { count: 'exact', head: true });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.searchQuery) {
        query = query.or(`title.ilike.%${filters.searchQuery}%,author.ilike.%${filters.searchQuery}%`);
      }

      const { count, error } = await query;

      if (error) {
        logger.error('Failed to get book count', error);
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error('BookService.getBookCount error', error);
      throw error;
    }
  }
}

export default BookService;