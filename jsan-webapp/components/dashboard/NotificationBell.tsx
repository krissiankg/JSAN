"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/roles';
import {
  type UserNotification,
  filterNotificationsByAppPrefs,
  formatRelativeTime,
  notificationTypeIcon,
} from '@/lib/notifications';

export default function NotificationBell() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const prefs = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...profile?.notification_preferences,
  };
  const visibleNotifications = filterNotificationsByAppPrefs(notifications, prefs);
  const unreadCount = visibleNotifications.filter((n) => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && data) {
      setNotifications(data as UserNotification[]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    const unreadIds = visibleNotifications.filter((n) => !n.is_read).map((n) => n.id);
    await supabase.from('user_notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => (unreadIds.includes(n.id) ? { ...n, is_read: true } : n)));
  };

  const handleNotificationClick = async (notification: UserNotification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="notification-bell-wrap" ref={containerRef}>
      <button
        type="button"
        className="icon-btn notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-all" onClick={markAllAsRead}>
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="notification-panel-body">
            {loading ? (
              <p className="notification-empty">Chargement…</p>
            ) : visibleNotifications.length === 0 ? (
              <p className="notification-empty">Aucune notification pour le moment.</p>
            ) : (
              visibleNotifications.map((notification) => {
                const content = (
                  <div
                    className={`notification-item ${notification.is_read ? '' : 'unread'}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <span className="notification-item-icon">{notificationTypeIcon(notification.type)}</span>
                    <div className="notification-item-content">
                      <div className="notification-item-title">{notification.title}</div>
                      {notification.body && (
                        <div className="notification-item-body">{notification.body}</div>
                      )}
                      <div className="notification-item-time">{formatRelativeTime(notification.created_at)}</div>
                    </div>
                    {!notification.is_read && <span className="notification-unread-dot" />}
                  </div>
                );

                return notification.link ? (
                  <Link
                    key={notification.id}
                    href={notification.link}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={notification.id}>{content}</div>
                );
              })
            )}
          </div>

          <div className="notification-panel-footer">
            <Link href="/dashboard/profil" onClick={() => setIsOpen(false)}>
              Gérer les préférences
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
