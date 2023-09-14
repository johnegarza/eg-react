import { useTable, useFilters, usePagination } from 'react-table';

// Define a default filter method
const defaultFilterMethod = React.useCallback(
  (rows, columnIds, filterValue) => {
    return rows.filter(row => {
      const rowValue = row.values[parseInt(columnIds[0], 10)]; //TODO double check; docs say columnIds is a single element string array, examples imply it's an integer
      return rowValue !== undefined
        ? String(rowValue)
            .toLowerCase()
            .includes(String(filterValue).toLowerCase())
        : true; //TODO should this be false? design choice- if a given cell has no data, should this row be retained (current behavior) or removed (set to false)
    })
  }, 
  []
);

// Define a default UI for filtering
function DefaultColumnFilter({
  column: { filterValue, preFilteredRows, setFilter },
}) {
  const count = preFilteredRows.length

  return (
    <input
      value={filterValue || ''}
      onChange={e => setFilter(e.target.value || undefined)}
      placeholder={`Search ${count} records...`}
    />
  )
}

//function Table({ columns, data }) {
function RegionSetConfigWrapper(props) {

  const defaultColumn = React.useMemo(
    () => ({
      Filter: DefaultColumnFilter, // use default filter UI
      filter: defaultFilterMethod, // use the filter method
    }),
    [defaultFilterMethod] //TODO is this needed? only if filter methods changes I think, which currently shouldn't happen?
  )

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page, // Instead of using 'rows', we'll use page.
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize },
  } = useTable(
    {
      columns,
      data,
      initialState: { pageSize: 10 }, // TODO can remove, this is already the default, including to explicitly show that this was included when refactoring from the old code 
      defaultColumn,
    },
    useFilters, 
    usePagination 
  );

  // Render the UI for the table
  return (

  );
}

//table UI JSX to add within RegionSetConfig
<>
  <table {...getTableProps()}>
    <thead>
      {headerGroups.map(headerGroup => (
        <tr {...headerGroup.getHeaderGroupProps()}>
          {headerGroup.headers.map(column => (
            <th {...column.getHeaderProps()}>
              {column.render('Header')}
              <div>{column.canFilter ? column.render('Filter') : null}</div>
            </th>
          ))}
        </tr>
      ))}
    </thead>
    <tbody {...getTableBodyProps()}>
      {page.map(row => {
        prepareRow(row);
        return (
          <tr {...row.getRowProps()}>
            {row.cells.map(cell => (
              <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
            ))}
          </tr>
        );
      })}
    </tbody>
  </table>
  <div>
    <button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
      {'<<'}
    </button>
    {' '}
    <button onClick={() => previousPage()} disabled={!canPreviousPage}>
      {'<'}
    </button>
    {' '}
    <button onClick={() => nextPage()} disabled={!canNextPage}>
      {'>'}
    </button>
    {' '}
    <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
      {'>>'}
    </button>
    {' '}
    <span>
      Page{' '}
      <strong>
        {pageIndex + 1} of {pageOptions.length}
      </strong>{' '}
    </span>
    <select
      value={pageSize}
      onChange={e => {
        setPageSize(Number(e.target.value));
      }}
    >
      {/* TODO this seems hardcoded, should probably fox this after the behavior is better understood */}
      {[10, 20, 30, 40, 50].map(pageSize => (
        <option key={pageSize} value={pageSize}>
          Show {pageSize}
        </option>
      ))}
    </select>
  </div>
</>

