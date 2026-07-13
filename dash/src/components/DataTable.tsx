import { DataGrid, type DataGridProps } from "@mui/x-data-grid";

export type { GridColDef } from "@mui/x-data-grid";

const LINE = "#e7ebf0";

// One styled DataGrid for the whole dashboard: sortable, filterable (quick
// search + column filters via the toolbar), paginated, flat with 4px corners
// and the emerald hover — matches the rest of the UI. Pass rows/columns and,
// when a row's key isn't `id`, a getRowId.
export function DataTable({
  pageSize = 10,
  toolbar = true,
  ...rest
}: DataGridProps & { pageSize?: number; toolbar?: boolean }) {
  return (
    <DataGrid
      autoHeight
      showToolbar={toolbar}
      disableRowSelectionOnClick
      rowHeight={54}
      columnHeaderHeight={50}
      initialState={{ pagination: { paginationModel: { page: 0, pageSize } } }}
      pageSizeOptions={[pageSize, pageSize * 2, 50]}
      sx={{
        border: `1px solid ${LINE}`,
        borderRadius: "4px",
        bgcolor: "background.paper",
        fontSize: "0.95rem",
        "--DataGrid-containerBackground": "#f8fafc",
        "--DataGrid-rowBorderColor": LINE,
        "& .MuiDataGrid-columnHeader": { py: 0.5 },
        "& .MuiDataGrid-columnHeaderTitle": {
          fontWeight: 700,
          fontSize: "0.76rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "text.secondary",
        },
        "& .MuiDataGrid-cell": { borderColor: LINE, py: 0.75 },
        "& .MuiDataGrid-row:hover": { bgcolor: "#f8fafc" },
        "& .MuiDataGrid-columnSeparator": { display: "none" },
        "& .MuiDataGrid-footerContainer": { borderColor: LINE, minHeight: 48 },
        "& .MuiDataGrid-toolbarContainer": { p: 1.25, gap: 1 },
      }}
      {...rest}
    />
  );
}
