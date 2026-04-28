/**
 * AdminSponsorsPage.jsx — /admin/sponsors
 * List all sponsors with isActive toggle and drag-to-reorder.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { adminGetSponsors, adminPatchSponsor, adminDeleteSponsor } from '../api';
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
import { GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';

function SortableRow({ sponsor, togglingId, onToggle, onEdit, onDelete, deletingId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sponsor.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#f0f4ff' : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ width: 32, padding: '0 4px', cursor: 'grab', color: '#94a3b8' }} {...attributes} {...listeners}>
        <GripVertical size={16} />
      </td>
      <td style={{ fontWeight: 600 }}>{sponsor.name}</td>
      <td style={{ textAlign: 'center' }}>{sponsor.points}</td>
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
      <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
      </td>
    </tr>
  );
}

export default function AdminSponsorsPage() {
  const navigate = useNavigate();
  const [sponsors, setSponsors] = useState([]);
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
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Sponsors</h1>
          {savingOrder && <span style={{ fontSize: 12, color: 'var(--color-text-2)' }}>Saving order…</span>}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/sponsors/new')}>
          + New Sponsor
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />)}
        </div>
      )}

      {!loading && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sponsors.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }} />
                    <th>Name</th>
                    <th style={{ textAlign: 'center' }}>Points</th>
                    <th style={{ textAlign: 'center' }}>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sponsors.map(s => (
                    <SortableRow
                      key={s.id}
                      sponsor={s}
                      togglingId={togglingId}
                      onToggle={toggleActive}
                      onEdit={id => navigate(`/admin/sponsors/${id}`)}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </AdminLayout>
  );
}
