import React, { useState, useEffect, useRef } from 'react';
import { Send, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import logger from '@/utils/logger';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  otherUserId: string;
  otherUserName: string;
  bookTitle: string;
  transactionId: string;
}

interface Message {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_name: string;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  otherUserId,
  otherUserName,
  bookTitle,
  transactionId
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 실제 메시지 목록 가져오기
  const fetchMessages = async () => {
    if (!user || !transactionId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          message,
          created_at
        `)
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching messages:', error);
        return;
      }

      // 프로필 정보와 함께 메시지 매핑
      const messagesWithNames: Message[] = (data || []).map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        message: msg.message,
        created_at: msg.created_at,
        sender_name: msg.sender_id === user.id ? '나' : otherUserName
      }));

      // 메시지가 없으면 초기 메시지 생성
      if (messagesWithNames.length === 0) {
        const initialMessage = `📚 "${bookTitle}" 책을 대여하고 싶습니다.`;
        
        // DB에 초기 메시지 저장
        const { data: newMessageData, error: insertError } = await supabase
          .from('messages')
          .insert({
            transaction_id: transactionId,
            sender_id: otherUserId, // 요청자(borrower)가 보낸 것으로 설정
            receiver_id: user.id,
            message: initialMessage
          })
          .select()
          .single();

        if (!insertError && newMessageData) {
          messagesWithNames.push({
            id: newMessageData.id,
            sender_id: newMessageData.sender_id,
            message: newMessageData.message,
            created_at: newMessageData.created_at,
            sender_name: otherUserName
          });
        }
      }

      setMessages(messagesWithNames);
    } catch (error) {
      logger.error('Error:', error);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchMessages();
      
      // 실시간 메시지 구독 설정
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `transaction_id=eq.${transactionId}`
          },
          (payload) => {
            const newMessage: Message = {
              id: payload.new.id,
              sender_id: payload.new.sender_id,
              message: payload.new.message,
              created_at: payload.new.created_at,
              sender_name: payload.new.sender_id === user.id ? '나' : otherUserName
            };
            setMessages(prev => [...prev, newMessage]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, user, transactionId, otherUserName]);

  useEffect(() => {
    // 새 메시지가 추가될 때 스크롤을 맨 아래로
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollElement) {
          setTimeout(() => {
            scrollElement.scrollTop = scrollElement.scrollHeight;
          }, 100);
        }
      }
    };

    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || loading) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // 즉시 입력창 비우기
    setLoading(true);

    try {
      // DB에 메시지 저장 (실시간 구독으로 자동 업데이트됨)
      const { error } = await supabase
        .from('messages')
        .insert({
          transaction_id: transactionId,
          sender_id: user.id,
          receiver_id: otherUserId,
          message: messageText
        });

      if (error) {
        throw error;
      }

      toast({
        title: "메시지 전송됨",
        description: "메시지가 성공적으로 전송되었습니다.",
      });

    } catch (error) {
      logger.error('Error sending message:', error);
      // 에러 시 입력창에 다시 텍스트 복원
      setNewMessage(messageText);
      toast({
        title: "메시지 전송 실패",
        description: "메시지 전송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleRequestResponse = async (action: 'approved' | 'rejected') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: action })
        .eq('id', transactionId);

      if (error) {
        throw error;
      }

      toast({
        title: action === 'approved' ? "대여 승인됨" : "대여 거절됨",
        description: `대여 요청이 ${action === 'approved' ? '승인' : '거절'}되었습니다.`,
      });

      // 성공 시 모달 닫기
      onClose();
    } catch (error) {
      logger.error('Error updating transaction:', error);
      toast({
        title: "오류 발생",
        description: "상태 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[600px] p-0 gap-0">
        <DialogHeader className="p-4 border-b bg-accent/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">{otherUserName}</DialogTitle>
              <p className="text-sm text-muted-foreground">"{bookTitle}" 대여 관련</p>
            </div>
          </div>
          
          {/* 승인/거절 버튼 */}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => handleRequestResponse('approved')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              승인
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRequestResponse('rejected')}
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            >
              거절
            </Button>
          </div>
        </DialogHeader>

        {/* 메시지 영역 */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.sender_id === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-accent text-accent-foreground'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.message}</p>
                  <p className={`text-xs mt-1 ${
                    message.sender_id === user?.id
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  }`}>
                    {formatMessageTime(message.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* 메시지 입력 영역 */}
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              placeholder="메시지를 입력하세요..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || loading}
              size="sm"
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};