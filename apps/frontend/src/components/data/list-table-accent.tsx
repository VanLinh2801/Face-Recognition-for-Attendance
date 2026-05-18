export function ListTableAccent() {
  return (
    <>
      <span aria-hidden="true" className="persons-table-corner persons-table-corner-top-right">
        <span className="persons-table-corner-line persons-table-corner-line-horizontal" />
        <span className="persons-table-corner-line persons-table-corner-line-vertical" />
      </span>
      <span aria-hidden="true" className="persons-table-corner persons-table-corner-bottom-left">
        <span className="persons-table-corner-line persons-table-corner-line-horizontal" />
        <span className="persons-table-corner-line persons-table-corner-line-vertical" />
      </span>
    </>
  );
}
