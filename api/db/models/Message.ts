import { BaseModel } from './BaseModel.js';
import { Message, MessageType } from '../../../shared/types.js';
import { executeQuery, fetchAll } from '../database.js';

export class MessageModel extends BaseModel<Message> {
  protected tableName = 'messages';

  protected fromRow(row: any): Message {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as MessageType,
      title: row.title,
      content: row.content,
      relatedId: row.related_id,
      isRead: row.is_read === 1,
      createdAt: row.created_at
    };
  }

  create(data: Omit<Message, 'id' | 'createdAt' | 'isRead'>): Message {
    const id = this.generateId();
    executeQuery(
      'INSERT INTO messages (id, user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.userId, data.type, data.title, data.content, data.relatedId || null]
    );
    return this.findById(id)!;
  }

  findByUserId(userId: string, unreadOnly: boolean = false): Message[] {
    const where = unreadOnly ? 'user_id = ? AND is_read = 0' : 'user_id = ?';
    return this.findAll(where, [userId]);
  }

  findByType(userId: string, type: MessageType): Message[] {
    return this.findAll('user_id = ? AND type = ?', [userId, type]);
  }

  markAsRead(id: string): Message {
    executeQuery('UPDATE messages SET is_read = 1 WHERE id = ?', [id]);
    return this.findById(id)!;
  }

  markAllAsRead(userId: string): void {
    executeQuery('UPDATE messages SET is_read = 1 WHERE user_id = ?', [userId]);
  }

  getUnreadCount(userId: string): number {
    const rows = fetchAll('SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND is_read = 0', [userId]);
    return rows[0]?.count || 0;
  }

  async sendAppointmentNotification(userId: string, appointmentCode: string, status: string): Promise<Message> {
    const statusMessages: Record<string, { title: string; content: string }> = {
      confirmed: {
        title: '预约成功',
        content: `您的预约已确认，就诊码：${appointmentCode}。请准时就诊。`
      },
      cancelled: {
        title: '预约已取消',
        content: `您的预约（就诊码：${appointmentCode}）已取消。`
      },
      completed: {
        title: '就诊完成',
        content: `您的就诊已完成（就诊码：${appointmentCode}）。请及时支付费用。`
      }
    };

    const msg = statusMessages[status] || statusMessages.confirmed;
    return this.create({
      userId,
      type: 'appointment',
      title: msg.title,
      content: msg.content,
      relatedId: appointmentCode
    });
  }

  sendPrescriptionNotification(userId: string, prescriptionId: string, status: string): Message {
    const statusMessages: Record<string, { title: string; content: string }> = {
      reviewed: {
        title: '处方已审核',
        content: '您的处方已通过审核，可以前往药房取药。'
      },
      dispensed: {
        title: '药品已配好',
        content: '您的药品已配好，请凭取药码前往药房领取。'
      },
      need_confirmation: {
        title: '处方待确认',
        content: '部分药品缺货，已为您推荐替代品，请确认处方。'
      }
    };

    const msg = statusMessages[status] || statusMessages.reviewed;
    return this.create({
      userId,
      type: 'prescription',
      title: msg.title,
      content: msg.content,
      relatedId: prescriptionId
    });
  }

  sendPaymentNotification(userId: string, amount: number): Message {
    return this.create({
      userId,
      type: 'payment',
      title: '支付成功',
      content: `您已成功支付 ¥${amount.toFixed(2)}，感谢您的信任！`,
      relatedId: userId
    });
  }

  sendComplaintNotification(userId: string, complaintId: string, status: string): Message {
    const statusMessages: Record<string, { title: string; content: string }> = {
      assigned: {
        title: '投诉已受理',
        content: '您的投诉已受理，我们将尽快处理并回复您。'
      },
      resolved: {
        title: '投诉已处理',
        content: '您的投诉已处理完成，请查看处理结果并确认。'
      },
      closed: {
        title: '投诉已关闭',
        content: '感谢您的反馈，我们将持续改进服务质量。'
      }
    };

    const msg = statusMessages[status] || statusMessages.assigned;
    return this.create({
      userId,
      type: 'complaint',
      title: msg.title,
      content: msg.content,
      relatedId: complaintId
    });
  }

  sendSystemNotification(userId: string, title: string, content: string): Message {
    return this.create({
      userId,
      type: 'system',
      title,
      content
    });
  }
}

export const messageModel = new MessageModel();
