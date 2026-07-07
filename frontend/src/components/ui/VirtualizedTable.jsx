import React, { forwardRef, useMemo, useRef, useEffect } from 'react';
import { FixedSizeList, VariableSizeList } from 'react-window';
import './VirtualizedTable.css';

function buildGridTemplate(columns) {
  return columns.map(c => c.width || '1fr').join(' ');
}

function HeaderRow({ columns, gridTemplate, onSort, sortCol, sortDir }) {
  return (
    <div className="vt-header" style={{ gridTemplateColumns: gridTemplate }}>
      {columns.map((col) => {
        const isSorted = sortCol === col.key;
        const cls = [
          'vt-cell',
          'vt-header-cell',
          col.align === 'right' ? 'vt-right' : '',
          col.sortable ? 'vt-sortable' : '',
          col.headerClassName || '',
        ].filter(Boolean).join(' ');
        return (
          <div
            key={col.key}
            className={cls}
            onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
          >
            {col.label}
            {col.sortable && isSorted && <span className="vt-sort-ind">{sortDir === 'asc' ? '▲' : '▼'}</span>}
          </div>
        );
      })}
    </div>
  );
}

function BodyRow({ index, style, data }) {
  const { columns, rows, gridTemplate, renderExpanded, isExpanded, onRowClick, rowHeight } = data;
  const row = rows[index];
  if (!row) return null;
  const expanded = isExpanded?.(index) ?? false;

  return (
    <div style={style} className="vt-row-wrapper">
      <div
        className={`vt-row ${expanded ? 'vt-row--expanded' : ''} ${onRowClick ? 'vt-row--clickable' : ''}`}
        style={{ gridTemplateColumns: gridTemplate, height: rowHeight }}
        onClick={onRowClick ? () => onRowClick(index, row) : undefined}
      >
        {columns.map((col) => {
          const cls = [
            'vt-cell',
            col.align === 'right' ? 'vt-right' : '',
            col.cellClassName || '',
          ].filter(Boolean).join(' ');
          return (
            <div key={col.key} className={cls}>
              {col.render ? col.render(row, index) : row[col.key]}
            </div>
          );
        })}
      </div>
      {expanded && renderExpanded && (
        <div className="vt-expanded">
          {renderExpanded(row, index)}
        </div>
      )}
    </div>
  );
}

const VirtualizedTable = forwardRef(function VirtualizedTable(
  {
    columns,
    rows,
    rowHeight = 48,
    height = 520,
    onSort,
    sortCol,
    sortDir,
    isExpanded,
    renderExpanded,
    getItemHeight,
    onRowClick,
    emptyMessage = 'Aucun résultat',
  },
  ref,
) {
  const gridTemplate = useMemo(() => buildGridTemplate(columns), [columns]);
  const listRef = useRef(null);
  useEffect(() => { if (ref) ref.current = listRef.current; }, [ref]);

  const itemData = useMemo(() => ({
    columns, rows, gridTemplate, renderExpanded, isExpanded, onRowClick, rowHeight,
  }), [columns, rows, gridTemplate, renderExpanded, isExpanded, onRowClick, rowHeight]);

  if (rows.length === 0) {
    return (
      <div className="vt-wrapper">
        <HeaderRow columns={columns} gridTemplate={gridTemplate} onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
        <div className="vt-empty">{emptyMessage}</div>
      </div>
    );
  }

  const Body = getItemHeight ? VariableSizeList : FixedSizeList;
  const bodyProps = getItemHeight
    ? { itemSize: getItemHeight }
    : { itemSize: rowHeight };

  return (
    <div className="vt-wrapper">
      <HeaderRow columns={columns} gridTemplate={gridTemplate} onSort={onSort} sortCol={sortCol} sortDir={sortDir} />
      <Body
        ref={listRef}
        height={height}
        itemCount={rows.length}
        width="100%"
        itemData={itemData}
        {...bodyProps}
      >
        {BodyRow}
      </Body>
    </div>
  );
});

export default VirtualizedTable;
