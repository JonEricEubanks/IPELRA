/**
 * AdminSponsorsPage.jsx — /admin/sponsors
 * List all sponsors with isActive toggle and drag-to-reorder.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { adminGetSponsors, adminPatchSponsor, adminDeleteSponsor, adminGetMetrics } from '../api';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

function SortableRow({ sponsor, stats, togglingId, onToggle, onEdit, onDelete, deletingId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sponsor.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#f0f4ff' : undefined,
  };
  const checkins = stats?.checkinCount ?? 0;
  const stuck    = stats?.stuckAttendees ?? 0;

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ width: 32, padding: '0 4px', cursor: 'grab', color: '#94a3b8' }} {...attributes} {...listeners} aria-label="Drag to reorder">
        <GripVertical size={16} />
      </td>
      <td>
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {sponsor.name}
          {sponsor.isActive && checkins === 0 && <span className="dead-badge">No visits yet</span>}
          {stuck > 0 && <span className="stuck-badge" title="Attendees who used all 3 answer attempts">{stuck} stuck</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-on-surface-muted)', textTransform: 'capitalize' }}>{sponsor.tier}</div>
      </td>
      <td style={{ textAlign: 'center', fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>{sponsor.pointValue ?? sponsor.points}</td>
      <td style={{ textAlign: 'center', fontWeight: 800, fontFamily: 'Manrope, sans-serif', fontSize: 16 }}>{checkins}</td>
      <td style={{ textAlign: 'center' }}>
        <button
          style={{
            background: sponsor.isActive ? 'var(--color-success)' : '#d1d5db',
            color: '#fff', border: 'none', borderRadius: 999,
            padding: '4px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            opacity: togglingId === sponsor.id ? 0.6 : 1,
          }}
          onClick={() => onToggle(sponsor)}
          disabled={togglingId === sponsor.id}
        >
          {sponsor.isActive ? 'On' : 'Off'}
        </button>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(sponsor.id)}>
            Edit
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: '#ef4444', opacity: deletingId === sponsor.id ? 0.5 : 1 }}
            onClick={() => onDelete(sponsor)}
            disabled={deletingId === sponsor.id}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminSponsorsPage() {
  const navigate = useNavigate();
  const [sponsors, setSponsors] = useState([]);
  const [stats, setStats] = useState({});       // sponsorId -> { checkinCount, stuckAttendees }
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    adminGetSponsors()
      .then(d => setSponsors(d.sponsors ?? []))
      .catch(() => toast.error('Failed to load sponsors.'))
      .finally(() => setLoading(false));
    // Stats are a nice-to-have — never block the list on them
    adminGetMetrics()
      .then(m => setStats(Object.fromEntries((m.sponsors ?? []).map(s => [s.sponsorId, s]))))
      .catch(() => {});
  }, []);

  async function toggleActive(sponsor) {
    setTogglingId(sponsor.id);
    try {
      await adminPatchSponsor(sponsor.id, { isActive: !sponsor.isActive });
      setSponsors(prev => prev.map(s => s.id === sponsor.id ? { ...s, isActive: !s.isActive } : s));
      toast.success(`${sponsor.name} ${!sponsor.isActive ? 'activated' : 'deactivated'}.`);
    } catch {
      toast.error('Failed to update sponsor.');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(sponsor) {
    if (!window.confirm(`Delete "${sponsor.name}"? This cannot be undone.`)) return;
    setDeletingId(sponsor.id);
    try {
      await adminDeleteSponsor(sponsor.id);
      setSponsors(prev => prev.filter(s => s.id !== sponsor.id));
      toast.success(`${sponsor.name} deleted.`);
    } catch {
      toast.error('Failed to delete sponsor.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sponsors.findIndex(s => s.id === active.id);
    const newIndex = sponsors.findIndex(s => s.id === over.id);
    const reordered = arrayMove(sponsors, oldIndex, newIndex);
    setSponsors(reordered);

    // Persist new display order
    setSavingOrder(true);
    try {
      await Promise.all(
        reordered.map((s, i) => adminPatchSponsor(s.id, { displayOrder: i }))
      );
      toast.success('Display order saved.');
    } catch {
      toast.error('Order saved locally but failed to persist.');
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <AdminLayout
      title="Sponsors"
      subtitle={loading ? 'Loading…' : `${sponsors.filter(s => s.isActive).length} active of ${sponsors.length} · drag to change the order attendees see${savingOrder ? ' · saving…' : ''}`}
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/sponsors/new')}>
          <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />New sponsor
        </button>
      }
    >
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      )}

      {!loading && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sponsors.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }} />
                      <th>Sponsor</th>
                      <th style={{ textAlign: 'center' }}>Points</th>
                      <th style={{ textAlign: 'center' }}>Check-ins</th>
                      <th style={{ textAlign: 'center' }}>Active</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sponsors.map(s => (
                      <SortableRow
                        key={s.id}
                        sponsor={s}
                        stats={stats[s.id]}
                        togglingId={togglingId}
                        onToggle={toggleActive}
                        onEdit={id => navigate(`/admin/sponsors/${id}`)}
                        onDelete={handleDelete}
                        deletingId={deletingId}
                      />
                    ))}
                    {sponsors.length === 0 && (
                      <tr><td colSpan={6} className="empty-mini">No sponsors yet — add the first one.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </AdminLayout>
  );
}
