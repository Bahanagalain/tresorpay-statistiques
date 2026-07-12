import React, { useState, useEffect } from 'react';
import { Calculator, Plus, Pencil, Trash2, Play, Save, X } from 'lucide-react';
import {
  fetchIndicateurs, createIndicateur, updateIndicateur,
  deleteIndicateur, computeIndicateur, fetchDatasets,
} from '../../api/biApi';
import WeaveSpinner from '../../components/ui/WeaveSpinner';
import './bi.css';

const MESURE_TYPES = [
  { value: 'COUNT', label: 'Nombre (COUNT)' },
  { value: 'SUM', label: 'Somme (SUM)' },
  { value: 'AVG', label: 'Moyenne (AVG)' },
  { value: 'RATIO', label: 'Ratio (RATIO)' },
];

const COLONNES = [
  { value: 'montant', label: 'Montant' },
  { value: 'montant_paye', label: 'Montant payé' },
];

const FORMATS = [
  { value: 'montant', label: 'Montant (FCFA)' },
  { value: 'pourcentage', label: 'Pourcentage (%)' },
  { value: 'entier', label: 'Entier' },
];

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const EMPTY_FORM = {
  code: '',
  libelle: '',
  datasetCode: 'soumissions',
  mesure: 'COUNT',
  colonne: 'montant',
  format: 'entier',
  filtreNumerateur: '',
  filtreDenominateur: '',
  filtresDefaut: '',
};

export default function IndicateurBuilder() {
  const [indicateurs, setIndicateurs] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null = creation, id = edition
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState(false);

  // Load indicateurs + datasets
  useEffect(() => {
    Promise.all([
      fetchIndicateurs(),
      fetchDatasets(),
    ])
      .then(([indRes, dsRes]) => {
        setIndicateurs(indRes?.datas || indRes || []);
        setDatasets(dsRes?.datas || dsRes || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleLibelleChange = (val) => {
    setForm(prev => ({
      ...prev,
      libelle: val,
      code: editing ? prev.code : slugify(val),
    }));
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setTestResult(null);
    setShowForm(false);
  };

  const openEdit = (ind) => {
    setForm({
      code: ind.code,
      libelle: ind.libelle,
      datasetCode: ind.datasetCode || 'soumissions',
      mesure: ind.mesure || 'COUNT',
      colonne: ind.colonne || 'montant',
      format: ind.format || 'entier',
      filtreNumerateur: ind.filtreNumerateur ? JSON.stringify(ind.filtreNumerateur) : '',
      filtreDenominateur: ind.filtreDenominateur ? JSON.stringify(ind.filtreDenominateur) : '',
      filtresDefaut: ind.filtresDefaut ? JSON.stringify(ind.filtresDefaut) : '',
    });
    setEditing(ind.id);
    setTestResult(null);
    setShowForm(true);
  };

  const handleTest = async () => {
    if (!editing && !form.code) return;
    setTesting(true);
    setTestResult(null);
    try {
      // For new indicateurs not yet saved, we compute with a temp body
      const targetId = editing;
      if (targetId) {
        const res = await computeIndicateur(targetId, {});
        setTestResult(res?.datas ?? res);
      } else {
        setTestResult({ info: 'Sauvegardez d\'abord pour tester' });
      }
    } catch (err) {
      setTestResult({ erreur: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.libelle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code,
        libelle: form.libelle,
        datasetCode: form.datasetCode,
        mesure: form.mesure,
        colonne: ['SUM', 'AVG'].includes(form.mesure) ? form.colonne : undefined,
        format: form.format,
        filtreNumerateur: form.filtreNumerateur ? JSON.parse(form.filtreNumerateur) : undefined,
        filtreDenominateur: form.filtreDenominateur ? JSON.parse(form.filtreDenominateur) : undefined,
        filtresDefaut: form.filtresDefaut ? JSON.parse(form.filtresDefaut) : undefined,
      };

      if (editing) {
        const res = await updateIndicateur(editing, payload);
        const updated = res?.datas || res;
        setIndicateurs(prev => prev.map(i => i.id === editing ? { ...i, ...updated } : i));
      } else {
        const res = await createIndicateur(payload);
        const created = res?.datas || res;
        setIndicateurs(prev => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet indicateur ?')) return;
    try {
      await deleteIndicateur(id);
      setIndicateurs(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <WeaveSpinner size={80} message="Chargement des indicateurs..." />;

  return (
    <div className="bi-indicateur-builder">
      {/* Header */}
      <div className="bi-list-header">
        <h1><Calculator size={22} /> Indicateurs</h1>
        {!showForm && (
          <button className="bi-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={15} /> Nouvel indicateur
          </button>
        )}
      </div>

      {error && <p className="bi-error-msg">{error}</p>}

      <div className="bi-indicateur-layout">
        {/* Liste existante */}
        <div className="bi-indicateur-list-section">
          <h3>Indicateurs existants</h3>
          {indicateurs.length === 0 && <p className="bi-empty-text">Aucun indicateur défini.</p>}
          <div className="bi-indicateur-items">
            {indicateurs.map(ind => (
              <div
                key={ind.id}
                className={`bi-indicateur-item ${ind.systeme ? 'systeme' : ''}`}
              >
                <div className="bi-indicateur-item-info">
                  <span className="bi-indicateur-item-code">{ind.code}</span>
                  <span className="bi-indicateur-item-libelle">{ind.libelle}</span>
                  <span className="bi-indicateur-item-meta">
                    {ind.datasetCode} &middot; {ind.mesure} &middot; {ind.format || 'entier'}
                  </span>
                </div>
                <div className="bi-indicateur-item-actions">
                  {!ind.systeme && (
                    <>
                      <button title="Modifier" onClick={() => openEdit(ind)}>
                        <Pencil size={14} />
                      </button>
                      <button title="Supprimer" className="danger" onClick={() => handleDelete(ind.id)}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <button title="Tester" onClick={() => { openEdit(ind); setTimeout(handleTest, 100); }}>
                    <Play size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bi-indicateur-form-section">
            <div className="bi-indicateur-form-header">
              <h3>{editing ? 'Modifier l\'indicateur' : 'Nouvel indicateur'}</h3>
              <button className="bi-library-close" onClick={resetForm}><X size={16} /></button>
            </div>

            <div className="bi-indicateur-form">
              {/* Libellé */}
              <label>Libellé</label>
              <input
                type="text"
                value={form.libelle}
                onChange={e => handleLibelleChange(e.target.value)}
                placeholder="Ex: Taux de recouvrement"
              />

              {/* Code */}
              <label>Code (auto-généré)</label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="taux_recouvrement"
              />

              {/* Dataset */}
              <label>Dataset</label>
              <select
                value={form.datasetCode}
                onChange={e => setForm(prev => ({ ...prev, datasetCode: e.target.value }))}
              >
                {datasets.length > 0
                  ? datasets.map(ds => (
                    <option key={ds.code} value={ds.code}>{ds.libelle || ds.code}</option>
                  ))
                  : <>
                    <option value="soumissions">Soumissions</option>
                    <option value="demandes_partenaire">Demandes partenaire</option>
                    <option value="audit">Audit</option>
                  </>
                }
              </select>

              {/* Type de mesure */}
              <label>Type de mesure</label>
              <select
                value={form.mesure}
                onChange={e => setForm(prev => ({ ...prev, mesure: e.target.value }))}
              >
                {MESURE_TYPES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              {/* Colonne (si SUM/AVG) */}
              {['SUM', 'AVG'].includes(form.mesure) && (
                <>
                  <label>Colonne</label>
                  <select
                    value={form.colonne}
                    onChange={e => setForm(prev => ({ ...prev, colonne: e.target.value }))}
                  >
                    {COLONNES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </>
              )}

              {/* RATIO : numérateur / dénominateur */}
              {form.mesure === 'RATIO' && (
                <>
                  <label>Filtre numérateur (JSON)</label>
                  <textarea
                    value={form.filtreNumerateur}
                    onChange={e => setForm(prev => ({ ...prev, filtreNumerateur: e.target.value }))}
                    placeholder='{"statut": "PAID"}'
                    rows={2}
                  />
                  <label>Filtre dénominateur (JSON, vide = tout)</label>
                  <textarea
                    value={form.filtreDenominateur}
                    onChange={e => setForm(prev => ({ ...prev, filtreDenominateur: e.target.value }))}
                    placeholder='{}'
                    rows={2}
                  />
                </>
              )}

              {/* Filtres par défaut */}
              <label>Filtres par défaut (JSON, optionnel)</label>
              <textarea
                value={form.filtresDefaut}
                onChange={e => setForm(prev => ({ ...prev, filtresDefaut: e.target.value }))}
                placeholder='{"periode": "2026-01", "ministere": "MINFI"}'
                rows={2}
              />

              {/* Format */}
              <label>Format d'affichage</label>
              <select
                value={form.format}
                onChange={e => setForm(prev => ({ ...prev, format: e.target.value }))}
              >
                {FORMATS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>

              {/* Actions */}
              <div className="bi-indicateur-form-actions">
                <button
                  className="bi-btn-secondary"
                  onClick={handleTest}
                  disabled={testing || !editing}
                >
                  <Play size={14} />
                  {testing ? 'Test...' : 'Tester'}
                </button>
                <button
                  className="bi-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !form.libelle.trim()}
                >
                  <Save size={14} />
                  {saving ? 'Enregistrement...' : 'Sauvegarder'}
                </button>
              </div>

              {/* Résultat du test */}
              {testResult && (
                <div className="bi-indicateur-test-result">
                  <h4>Résultat du test</h4>
                  <pre>{JSON.stringify(testResult, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
