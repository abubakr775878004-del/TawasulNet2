
'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hiddenNotificationIds, setHiddenNotificationIds] = useState(
    () => new Set()
  );

  const containerRef = useRef(null);

  async function loadNotifications() {
    if (!userId) return;

    setLoading(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from('notifications')
        .select(
          'id, title, message, type, reference_id, is_read, created_at'
        )
        .eq('user_id', userId)
        .order('created_at', {
          ascending: false,
        })
        .limit(20);

      if (error) {
        console.error(
          'Error loading notifications:',
          error
        );

        return;
      }

      const rows = data || [];

      setNotifications(rows);

      setUnreadCount(
        rows.filter(
          (item) => !item.is_read
        ).length
      );

      // إعادة إظهار الإشعارات المخفية مؤقتًا
      // عند إعادة تحميل القائمة فقط.
      setHiddenNotificationIds(new Set());
    } catch (error) {
      console.error(
        'Unexpected notifications error:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setHiddenNotificationIds(new Set());
      return;
    }

    loadNotifications();
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, []);

  async function markAsRead(notificationId) {
    if (!userId || !notificationId) {
      return;
    }

    const notification =
      notifications.find(
        (item) =>
          item.id === notificationId
      );

    if (
      !notification ||
      notification.is_read
    ) {
      return;
    }

    try {
      const {
        error,
      } = await supabase
        .from('notifications')
        .update({
          is_read: true,
        })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error(
          'Error marking notification as read:',
          error
        );

        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                is_read: true,
              }
            : item
        )
      );

      setUnreadCount((current) =>
        Math.max(0, current - 1)
      );
    } catch (error) {
      console.error(
        'Unexpected mark notification error:',
        error
      );
    }
  }

  function hideNotification(notificationId) {
    // إخفاء محلي فقط، دون حذف من قاعدة البيانات.
    setHiddenNotificationIds((current) => {
      const next = new Set(current);
      next.add(notificationId);
      return next;
    });
  }

  function formatTime(createdAt) {
    if (!createdAt) return '';

    try {
      return new Date(
        createdAt
      ).toLocaleString('ar-YE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  function getIcon(type) {
    switch (type) {
      case 'debt_payment':
        return '💰';

      case 'card_request_created':
        return '🔔';

      case 'card_request_approved':
        return '✅';

      case 'card_request_rejected':
        return '❌';

      default:
        return '🔔';
    }
  }

  const visibleNotifications = notifications.filter(
    (notification) =>
      !hiddenNotificationIds.has(notification.id)
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        zIndex: 200,
      }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);

          if (!open) {
            loadNotifications();
          }
        }}
        aria-label="الإشعارات"
        style={{
          position: 'relative',
          width: 43,
          height: 43,
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          background: '#FFFFFF',
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 19,
          cursor: 'pointer',
          boxShadow:
            '0 4px 14px rgba(15,23,42,0.06)',
        }}
      >
        🔔

        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -5,
              right: -5,
              minWidth: 19,
              height: 19,
              padding: '0 4px',
              borderRadius: 20,
              background: '#DC2626',
              color: '#fff',
              border: '2px solid #fff',
              fontSize: 9.5,
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99
              ? '99+'
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 50,
            right: 0,
            width:
              'min(360px, calc(100vw - 30px))',
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 18,
            boxShadow:
              '0 20px 55px rgba(15,23,42,0.18)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom:
                '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: '900',
                  color: '#1E293B',
                }}
              >
                الإشعارات
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 10.5,
                  color: '#94A3B8',
                }}
              >
                آخر الإشعارات الخاصة بحسابك
              </div>
            </div>

            {unreadCount > 0 && (
              <div
                style={{
                  background: '#FEF2F2',
                  color: '#DC2626',
                  padding: '5px 8px',
                  borderRadius: 9,
                  fontSize: 10,
                  fontWeight: '900',
                  whiteSpace: 'nowrap',
                }}
              >
                {unreadCount} غير مقروء
              </div>
            )}
          </div>

          <div
            style={{
              maxHeight: 390,
              overflowY: 'auto',
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: 25,
                  textAlign: 'center',
                  color: '#64748B',
                  fontSize: 12,
                }}
              >
                جاري تحميل الإشعارات...
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: 'center',
                  color: '#94A3B8',
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    marginBottom: 8,
                  }}
                >
                  🔔
                </div>

                لا توجد إشعارات حاليًا.
              </div>
            ) : (
              visibleNotifications.map(
                (notification) => {
                  const isDebtPayment =
                    notification.type === 'debt_payment';

                  return (
                    <div
                      key={notification.id}
                      style={{
                        position: 'relative',
                        borderBottom: '1px solid #F1F5F9',
                        background: isDebtPayment
                          ? notification.is_read
                            ? '#FFFFFF'
                            : '#F0FDF4'
                          : notification.is_read
                            ? '#FFFFFF'
                            : '#F8FAFC',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          markAsRead(notification.id)
                        }
                        aria-label={`قراءة إشعار: ${notification.title}`}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'right',
                          border: 'none',
                          background: 'transparent',
                          padding: '14px 42px 13px 15px',
                          cursor: notification.is_read
                            ? 'default'
                            : 'pointer',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                          }}
                        >
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              flexShrink: 0,
                              borderRadius: 12,
                              background: isDebtPayment
                                ? notification.is_read
                                  ? '#DCFCE7'
                                  : '#BBF7D0'
                                : notification.is_read
                                  ? '#F1F5F9'
                                  : '#EDE9FE',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 18,
                            }}
                          >
                            {getIcon(notification.type)}
                          </div>

                          <div
                            style={{
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: '900',
                                  color: isDebtPayment
                                    ? '#166534'
                                    : '#1E293B',
                                  lineHeight: 1.6,
                                }}
                              >
                                {notification.title}
                              </div>

                              {!notification.is_read && (
                                <span
                                  style={{
                                    width: 7,
                                    height: 7,
                                    flexShrink: 0,
                                    borderRadius: '50%',
                                    background: isDebtPayment
                                      ? '#16A34A'
                                      : '#7C3AED',
                                  }}
                                />
                              )}
                            </div>

                            {isDebtPayment && (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  marginTop: 5,
                                  padding: '4px 8px',
                                  borderRadius: 7,
                                  background: '#DCFCE7',
                                  color: '#166534',
                                  fontSize: 10,
                                  fontWeight: '900',
                                }}
                              >
                                سداد دين
                              </div>
                            )}

                            <div
                              style={{
                                marginTop: 5,
                                fontSize: 11.5,
                                lineHeight: 1.8,
                                color: '#64748B',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {notification.message}
                            </div>

                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 9.5,
                                color: '#94A3B8',
                              }}
                            >
                              {formatTime(notification.created_at)}
                            </div>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        aria-label="إخفاء الإشعار"
                        title="إخفاء الإشعار مؤقتًا"
                        onClick={() =>
                          hideNotification(notification.id)
                        }
                        style={{
                          position: 'absolute',
                          top: 9,
                          right: 8,
                          width: 25,
                          height: 25,
                          border: '1px solid #E2E8F0',
                          borderRadius: 8,
                          background: '#FFFFFF',
                          color: '#64748B',
                          fontSize: 17,
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
