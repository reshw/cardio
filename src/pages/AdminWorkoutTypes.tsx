import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Plus, GripVertical } from 'lucide-react';
import workoutTypeService from '../services/workoutTypeService';
import type { WorkoutType, CreateWorkoutTypeInput } from '../services/workoutTypeService';
import { supabase } from '../lib/supabase';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 드래그 가능한 운동 종목 아이템
function SortableWorkoutItem({
  workoutType,
  onEdit,
  onToggle,
  onDelete
}: {
  workoutType: WorkoutType;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: workoutType.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`workout-type-item ${!workoutType.is_active ? 'inactive' : ''}`}
    >
      <div className="drag-handle" {...attributes} {...listeners}>
        <GripVertical size={20} />
      </div>

      <div className="workout-type-info">
        <div className="workout-type-main">
          <span className="workout-type-emoji">{workoutType.emoji}</span>
          <span className="workout-type-name">{workoutType.name}</span>
          <span className="workout-type-unit">({workoutType.unit})</span>
          {workoutType.sub_type_mode === 'mixed' && (
            <span className="badge" style={{ fontSize: '11px', padding: '2px 6px', marginLeft: '6px' }}>
              복합형
            </span>
          )}
        </div>
        {workoutType.sub_types && workoutType.sub_types.length > 0 && (
          <div className="workout-type-subtypes">
            {workoutType.sub_types.map((st, idx) => (
              <span key={idx}>
                {st.name} ({st.unit}){idx < workoutType.sub_types.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="workout-type-actions">
        <button
          className="btn-text"
          onClick={onToggle}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            background: workoutType.is_active ? 'var(--secondary-bg)' : 'var(--primary-color)',
            color: workoutType.is_active ? 'var(--text-primary)' : 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {workoutType.is_active ? '비활성화' : '활성화'}
        </button>
        <button
          className="btn-text"
          onClick={onEdit}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            background: 'var(--primary-color)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          수정
        </button>
        <button
          className="btn-text btn-danger"
          onClick={onDelete}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

export const AdminWorkoutTypes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<WorkoutType | null>(null);
  const [showInactiveWorkouts, setShowInactiveWorkouts] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState<CreateWorkoutTypeInput>({
    name: '',
    emoji: '',
    unit: 'km',
    sub_types: [],
    sub_type_mode: 'single',
    is_core: false,
  });
  const [subTypeInput, setSubTypeInput] = useState('');
  const [subTypeUnit, setSubTypeUnit] = useState<'km' | 'm' | '층' | '분' | '회' | '세트'>('km');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!user?.is_admin) {
      alert('접근 권한이 없습니다.');
      navigate('/admin');
      return;
    }
    loadWorkoutTypes();
  }, [user, navigate]);

  const loadWorkoutTypes = async () => {
    setLoading(true);
    try {
      const data = await workoutTypeService.getAllWorkoutTypes();
      setWorkoutTypes(data);
    } catch (error) {
      console.error('운동 종목 조회 실패:', error);
      alert('운동 종목을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = workoutTypes.findIndex((t) => t.id === active.id);
      const newIndex = workoutTypes.findIndex((t) => t.id === over.id);

      const newOrder = arrayMove(workoutTypes, oldIndex, newIndex);
      setWorkoutTypes(newOrder);

      try {
        await workoutTypeService.reorderWorkoutTypes(newOrder.map((t) => t.id));
      } catch (error) {
        console.error('순서 변경 실패:', error);
        loadWorkoutTypes(); // 롤백
      }
    }
  };

  const handleOpenModal = (workoutType?: WorkoutType) => {
    if (workoutType) {
      setEditingType(workoutType);
      setFormData({
        name: workoutType.name,
        emoji: workoutType.emoji,
        unit: workoutType.unit,
        sub_types: workoutType.sub_types || [],
        sub_type_mode: workoutType.sub_type_mode || 'single',
        is_core: workoutType.is_core || false,
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        emoji: '',
        unit: 'km',
        sub_types: [],
        sub_type_mode: 'single',
        is_core: false,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingType(null);
    setSubTypeInput('');
    setSubTypeUnit('km');
  };

  const handleAddSubType = () => {
    if (!subTypeInput.trim()) return;

    // 복합형은 최대 2개까지만
    if (formData.sub_type_mode === 'mixed' && (formData.sub_types?.length || 0) >= 2) {
      alert('복합형은 최대 2개의 세부타입만 추가할 수 있습니다.');
      return;
    }

    setFormData({
      ...formData,
      sub_types: [...(formData.sub_types || []), { name: subTypeInput.trim(), unit: subTypeUnit }],
    });
    setSubTypeInput('');
    setSubTypeUnit(formData.unit); // 다음 서브타입은 기본 단위로 초기화
  };

  const handleRemoveSubType = (index: number) => {
    setFormData({
      ...formData,
      sub_types: formData.sub_types?.filter((_, i) => i !== index) || [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.emoji || !formData.unit) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    // 복합형은 정확히 2개의 세부타입이 필요
    if (formData.sub_type_mode === 'mixed' && formData.sub_types?.length !== 2) {
      alert('복합형(슬라이더)은 정확히 2개의 세부타입이 필요합니다.');
      return;
    }

    try {
      if (editingType) {
        await workoutTypeService.updateWorkoutType(editingType.id, formData);
        alert('운동 종목이 수정되었습니다.');
      } else {
        await workoutTypeService.createWorkoutType(formData);
        alert('운동 종목이 추가되었습니다.');
      }
      handleCloseModal();
      loadWorkoutTypes();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const handleToggle = async (workoutType: WorkoutType) => {
    try {
      await workoutTypeService.toggleActive(workoutType.id, !workoutType.is_active);
      loadWorkoutTypes();
    } catch (error) {
      console.error('토글 실패:', error);
      alert('변경에 실패했습니다.');
    }
  };

  const handleDelete = async (workoutType: WorkoutType) => {
    // 활성화된 운동은 삭제 불가
    if (workoutType.is_active) {
      alert(`"${workoutType.name}"을(를) 삭제하려면 먼저 비활성화해주세요.\n\n"비활성화" 버튼을 눌러 비활성화 후 삭제할 수 있습니다.`);
      return;
    }

    // 운동 기록 개수 확인
    try {
      const { count, error } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq('category', workoutType.name);

      if (error) {
        console.error('운동 기록 확인 실패:', error);
        alert('운동 기록을 확인하는데 실패했습니다.');
        return;
      }

      const workoutCount = count || 0;

      // 운동 기록이 있으면 삭제 불가
      if (workoutCount > 0) {
        alert(`❌ 삭제 불가\n\n"${workoutType.name}" 운동 기록이 ${workoutCount}개 있습니다.\n\n운동 종목 삭제는 개발자에게 문의해주세요.`);
        return;
      }

      // 운동 기록이 0개면 삭제 가능
      if (!confirm(`"${workoutType.name}"을(를) 정말 삭제하시겠습니까?\n\n⚠️ 영구 삭제되며 되돌릴 수 없습니다.`)) {
        return;
      }

      await workoutTypeService.deleteWorkoutType(workoutType.id);
      alert('✅ 삭제되었습니다.');
      loadWorkoutTypes();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate('/admin')}>
          <ChevronLeft size={24} />
        </button>
        <h1>운동 종목 관리</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>운동 목록</h2>
            <button
              className="btn-primary"
              onClick={() => handleOpenModal()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: '600',
                background: 'linear-gradient(135deg, var(--primary-color) 0%, #0ea5e9 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.3)';
              }}
            >
              <Plus size={20} />
              <span>운동 추가</span>
            </button>
          </div>

          <p className="form-hint" style={{ marginBottom: '20px' }}>
            드래그하여 순서를 변경할 수 있습니다
          </p>

          {/* 활성화된 운동 - 기본운동 */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: 'var(--primary-color)' }}>
              ⭐ 기본운동
            </h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={workoutTypes.filter(t => t.is_core && t.is_active).map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="workout-types-list">
                  {workoutTypes.filter(t => t.is_core && t.is_active).map((workoutType) => (
                    <SortableWorkoutItem
                      key={workoutType.id}
                      workoutType={workoutType}
                      onEdit={() => handleOpenModal(workoutType)}
                      onToggle={() => handleToggle(workoutType)}
                      onDelete={() => handleDelete(workoutType)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* 활성화된 운동 - 기타운동 */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>
              📦 기타운동
            </h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={workoutTypes.filter(t => !t.is_core && t.is_active).map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="workout-types-list">
                  {workoutTypes.filter(t => !t.is_core && t.is_active).map((workoutType) => (
                    <SortableWorkoutItem
                      key={workoutType.id}
                      workoutType={workoutType}
                      onEdit={() => handleOpenModal(workoutType)}
                      onToggle={() => handleToggle(workoutType)}
                      onDelete={() => handleDelete(workoutType)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* 비활성화된 운동 (접기/펼치기) */}
          {workoutTypes.filter(t => !t.is_active).length > 0 && (
            <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '2px solid var(--border-color)' }}>
              <button
                onClick={() => setShowInactiveWorkouts(!showInactiveWorkouts)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0',
                  marginBottom: showInactiveWorkouts ? '12px' : '0',
                }}
              >
                <span>{showInactiveWorkouts ? '▼' : '▶'}</span>
                <span>🚫 비활성화된 운동 ({workoutTypes.filter(t => !t.is_active).length}개)</span>
              </button>

              {showInactiveWorkouts && (
                <div className="workout-types-list" style={{ opacity: '0.7' }}>
                  {workoutTypes.filter(t => !t.is_active).map((workoutType) => (
                    <div
                      key={workoutType.id}
                      className="workout-type-item inactive"
                    >
                      <div className="workout-type-info" style={{ marginLeft: '40px' }}>
                        <div className="workout-type-main">
                          <span className="workout-type-emoji">{workoutType.emoji}</span>
                          <span className="workout-type-name">{workoutType.name}</span>
                          <span className="workout-type-unit">({workoutType.unit})</span>
                          {workoutType.sub_type_mode === 'mixed' && (
                            <span className="badge" style={{ fontSize: '11px', padding: '2px 6px', marginLeft: '6px' }}>
                              복합형
                            </span>
                          )}
                          {workoutType.is_core && (
                            <span className="badge" style={{ fontSize: '11px', padding: '2px 6px', marginLeft: '6px', background: 'var(--primary-color)' }}>
                              기본운동
                            </span>
                          )}
                        </div>
                        {workoutType.sub_types && workoutType.sub_types.length > 0 && (
                          <div className="workout-type-subtypes">
                            {workoutType.sub_types.map((st, idx) => (
                              <span key={idx}>
                                {st.name} ({st.unit}){idx < workoutType.sub_types.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="workout-type-actions">
                        <button
                          className="btn-text"
                          onClick={() => handleToggle(workoutType)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            background: 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          활성화
                        </button>
                        <button
                          className="btn-text"
                          onClick={() => handleOpenModal(workoutType)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            background: 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          수정
                        </button>
                        <button
                          className="btn-text btn-danger"
                          onClick={() => handleDelete(workoutType)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div
            className="modal-content"
            style={{
              maxWidth: 540,
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header"
              style={{
                background: 'linear-gradient(135deg, var(--primary-color) 0%, #0ea5e9 100%)',
                color: 'white',
                padding: '24px',
                borderRadius: '16px 16px 0 0',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                {editingType ? '✏️ 운동 수정' : '➕ 운동 추가'}
              </h2>
              <button
                className="modal-close"
                onClick={handleCloseModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '20px',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block', color: 'var(--text-primary)' }}>
                    운동 이름 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="예: 크로스핏"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-color)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block', color: 'var(--text-primary)' }}>
                    이모지 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.emoji}
                    onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                    placeholder="예: 🏋️"
                    maxLength={2}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '24px',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px',
                      transition: 'border-color 0.2s',
                      textAlign: 'center',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-color)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block', color: 'var(--text-primary)' }}>
                    단위 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '15px',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px',
                      transition: 'border-color 0.2s',
                      background: 'var(--secondary-bg)',
                      cursor: 'pointer',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-color)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    <option value="km">km (킬로미터)</option>
                    <option value="m">m (미터)</option>
                    <option value="층">층</option>
                    <option value="분">분</option>
                    <option value="회">회</option>
                    <option value="세트">세트</option>
                  </select>
                </div>

                <div
                  className="form-group"
                  style={{
                    marginBottom: '24px',
                    padding: '16px',
                    background: 'var(--secondary-bg)',
                    borderRadius: '8px',
                    border: '2px solid var(--border-color)',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={formData.is_core}
                      onChange={(e) => setFormData({ ...formData, is_core: e.target.checked })}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: 'var(--primary-color)',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
                        ⭐ 기본운동으로 설정
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        기록 추가 시 상단에 표시됩니다
                      </div>
                    </div>
                  </label>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'block', color: 'var(--text-primary)' }}>
                    세부타입 종류
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          sub_type_mode: 'single',
                        });
                      }}
                      style={{
                        padding: '16px',
                        background: formData.sub_type_mode === 'single' ? 'var(--primary-color)' : 'var(--secondary-bg)',
                        color: formData.sub_type_mode === 'single' ? 'white' : 'var(--text-primary)',
                        border: `2px solid ${formData.sub_type_mode === 'single' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
                        📱 선택형
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.9 }}>
                        버튼으로 하나 선택
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          sub_type_mode: 'mixed',
                          // 복합형으로 변경 시 기존 세부타입이 2개 초과면 처음 2개만 유지
                          sub_types: formData.sub_types && formData.sub_types.length > 2
                            ? formData.sub_types.slice(0, 2)
                            : formData.sub_types,
                        });
                      }}
                      style={{
                        padding: '16px',
                        background: formData.sub_type_mode === 'mixed' ? 'var(--primary-color)' : 'var(--secondary-bg)',
                        color: formData.sub_type_mode === 'mixed' ? 'white' : 'var(--text-primary)',
                        border: `2px solid ${formData.sub_type_mode === 'mixed' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
                        🎚️ 복합형
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.9 }}>
                        슬라이더로 비율 조정
                      </div>
                    </button>
                  </div>
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 16px',
                      background: formData.sub_type_mode === 'mixed' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      borderLeft: `3px solid ${formData.sub_type_mode === 'mixed' ? '#f97316' : '#3b82f6'}`,
                    }}
                  >
                    {formData.sub_type_mode === 'mixed'
                      ? '💡 복합형은 정확히 2개의 세부타입이 필요합니다 (예: 요가, 복싱)'
                      : '💡 선택형은 세부타입 개수 제한이 없습니다 (예: 달리기, 사이클)'}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block', color: 'var(--text-primary)' }}>
                    세부 타입 {formData.sub_type_mode === 'mixed' ? (
                      <span style={{ color: '#f97316', fontSize: '13px' }}>(정확히 2개 필요)</span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>(선택사항)</span>
                    )}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      value={subTypeInput}
                      onChange={(e) => setSubTypeInput(e.target.value)}
                      placeholder="예: 실내"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubType();
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        fontSize: '15px',
                        border: '2px solid var(--border-color)',
                        borderRadius: '8px',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary-color)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    />
                    <select
                      value={subTypeUnit}
                      onChange={(e) => setSubTypeUnit(e.target.value as any)}
                      style={{
                        padding: '12px 16px',
                        fontSize: '15px',
                        border: '2px solid var(--border-color)',
                        borderRadius: '8px',
                        background: 'var(--secondary-bg)',
                        cursor: 'pointer',
                        minWidth: '100px',
                      }}
                    >
                      <option value="km">km</option>
                      <option value="m">m</option>
                      <option value="층">층</option>
                      <option value="분">분</option>
                      <option value="회">회</option>
                      <option value="세트">세트</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddSubType}
                      style={{
                        padding: '12px 20px',
                        fontSize: '14px',
                        fontWeight: '600',
                        background: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      추가
                    </button>
                  </div>
                  {formData.sub_types && formData.sub_types.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {formData.sub_types.map((subType, index) => (
                        <span
                          key={index}
                          onClick={() => handleRemoveSubType(index)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            background: 'var(--primary-color)',
                            color: 'white',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#ef4444';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'var(--primary-color)';
                          }}
                        >
                          {subType.name} ({subType.unit})
                          <span style={{ fontSize: '16px' }}>✕</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    style={{
                      flex: 1,
                      padding: '14px',
                      fontSize: '15px',
                      fontWeight: '600',
                      background: 'var(--secondary-bg)',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--border-color)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'var(--secondary-bg)';
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '14px',
                      fontSize: '15px',
                      fontWeight: '600',
                      background: 'linear-gradient(135deg, var(--primary-color) 0%, #0ea5e9 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.3)';
                    }}
                  >
                    {editingType ? '✅ 수정 완료' : '➕ 추가 완료'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
