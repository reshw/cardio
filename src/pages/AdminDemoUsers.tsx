import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Copy, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface DemoUserRow {
  tmp_number: number;
  user_id: string;
  label: string | null;
  created_at: string;
  display_name?: string;
}

export const AdminDemoUsers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<DemoUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.is_admin) {
      alert('접근 권한이 없습니다.');
      navigate('/more');
    }
  }, [user, navigate]);

  const load = async () => {
    setLoading(true);
    const { data: demoRows } = await supabase
      .from('demo_users')
      .select('tmp_number, user_id, label, created_at')
      .order('tmp_number', { ascending: true });

    if (!demoRows) {
      setRows([]);
      setLoading(false);
      return;
    }

    const ids = demoRows.map((r) => r.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', ids);

    const nameMap = new Map((users || []).map((u) => [u.id, u.display_name]));
    setRows(
      demoRows.map((r) => ({
        ...r,
        display_name: nameMap.get(r.user_id) || '(이름 없음)',
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) {
      alert('라벨을 입력하세요.');
      return;
    }
    setAdding(true);

    // users 테이블에 테스터 계정 생성
    const username = `tester_${Date.now()}`;
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({ username, display_name: label, is_tester: true, provider: 'demo' })
      .select('id')
      .single();

    if (userError || !newUser) {
      alert(`계정 생성 실패: ${userError?.message}`);
      setAdding(false);
      return;
    }

    // tmp_number 자동 부여
    const maxTmp = rows.length > 0 ? Math.max(...rows.map((r) => r.tmp_number)) : -1;
    const tmp = maxTmp + 1;

    const { error: demoError } = await supabase.from('demo_users').insert({
      tmp_number: tmp,
      user_id: newUser.id,
      label,
    });

    if (demoError) {
      alert(`등록 실패: ${demoError.message}`);
      setAdding(false);
      return;
    }

    setNewLabel('');
    setShowAdd(false);
    setAdding(false);
    showToast(`tmp=${tmp} 생성 완료`);
    load();
  };

  const handleDelete = async (tmp: number, userId: string) => {
    if (!confirm(`tmp=${tmp} 계정을 삭제하시겠어요?\n(users 테이블의 계정도 함께 삭제됩니다)`)) return;

    // demo_users 먼저 삭제 (FK 제약)
    await supabase.from('demo_users').delete().eq('tmp_number', tmp);
    // 테스터 계정이면 users에서도 삭제
    await supabase.from('users').delete().eq('id', userId).eq('is_tester', true);

    showToast(`tmp=${tmp} 삭제 완료`);
    load();
  };

  const handleCopy = async (tmp: number) => {
    const url = `${window.location.origin}/?tmp=${tmp}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('링크 복사 완료');
    } catch {
      prompt('복사하세요:', url);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate('/admin')}>
          <ChevronLeft size={24} />
        </button>
        <h1>데모 계정 관리</h1>
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: '#22c55e',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {toast}
        </div>
      )}

      <div className="settings-content" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>
          테스터 계정을 생성하고 링크를 발급합니다. tmp=0은 "데모 체험하기" 기본 계정입니다.
        </div>

        <button
          onClick={() => setShowAdd((v) => !v)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 8,
            border: '1px dashed #aaa',
            background: showAdd ? '#f5f5f5' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          <Plus size={16} />
          {showAdd ? '취소' : '테스터 계정 생성'}
        </button>

        {showAdd && (
          <div
            style={{
              padding: 16,
              border: '1px solid #e0e0e0',
              borderRadius: 8,
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <label style={{ fontSize: 13, color: '#444' }}>
              라벨 (이름으로 표시됨)
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="예: 김아무개 테스터"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  marginTop: 4,
                  borderRadius: 6,
                  border: '1px solid #ccc',
                  fontSize: 13,
                }}
              />
            </label>
            <button
              onClick={handleAdd}
              disabled={adding}
              style={{
                padding: '10px',
                borderRadius: 6,
                border: 'none',
                background: adding ? '#ccc' : '#FFD700',
                color: '#000',
                fontSize: 14,
                fontWeight: 600,
                cursor: adding ? 'not-allowed' : 'pointer',
              }}
            >
              {adding ? '생성 중...' : '생성'}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>로딩 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 32, fontSize: 13 }}>
            등록된 테스터 계정이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((row) => (
              <div
                key={row.tmp_number}
                style={{
                  padding: 12,
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  background: row.tmp_number === 0 ? '#FFFDE7' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: row.tmp_number === 0 ? '#FFA000' : '#666',
                      color: '#fff',
                    }}
                  >
                    tmp={row.tmp_number}
                    {row.tmp_number === 0 ? ' (기본)' : ''}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{row.display_name}</span>
                </div>
                {row.label && row.label !== row.display_name && (
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{row.label}</div>
                )}
                <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', marginBottom: 8 }}>
                  {row.user_id}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleCopy(row.tmp_number)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #ccc',
                      background: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Copy size={12} />
                    링크 복사
                  </button>
                  <button
                    onClick={() => handleDelete(row.tmp_number, row.user_id)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #f5b5b5',
                      background: '#fff',
                      color: '#d32f2f',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Trash2 size={12} />
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
