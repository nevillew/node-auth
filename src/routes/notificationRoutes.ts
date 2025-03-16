import express, { Router, Request, Response } from 'express';
import { authenticateHandler } from '../middleware';
import notificationService from '../services/notificationService';
import { Notification } from '../models';
import { AuthenticatedRequest } from '../types';

/**
 * Get user notifications handler (pure async function)
 */
const getUserNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * Mark notification as read handler (pure async function)
 */
const markNotificationAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    await notification.update({ read: true });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * Delete notification handler (pure async function)
 */
const deleteNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    await notification.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

/**
 * Create and configure notification routes (factory function)
 */
const createNotificationRouter = (): Router => {
  const router = express.Router();

  // Get user notifications
  router.get('/', authenticateHandler, getUserNotifications);

  // Mark notification as read
  router.put('/:id/read', authenticateHandler, markNotificationAsRead);

  // Delete notification
  router.delete('/:id', authenticateHandler, deleteNotification);

  return router;
};

// Create and export the router
export default createNotificationRouter();