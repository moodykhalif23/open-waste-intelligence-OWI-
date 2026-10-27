import { DataGrid, type DataGridProps } from "@mui/x-data-grid";

export type { GridColDef } from "@mui/x-data-grid";

const LINE = "#eae6dd";

// The one DataGrid for the whole dashboard, styled to match the flat UI.
// Pass a getRowId when a row's key isn't `id`.
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
      getRowHeight={() => "auto"}
      columnHeaderHeight={50}
      initialState={{ pagination: { paginationModel: { page: 0, pageSize } } }}
      pageSizeOptions={[pageSize, pageSize * 2, 50]}
      sx={{
        border: `1px solid ${LINE}`,
        borderRadius: "4px",
        bgcolor: "background.paper",
        fontSize: "0.95rem",
        "--DataGrid-containerBackground": "#f6f4ee",
        "--DataGrid-rowBorderColor": LINE,
        "& .MuiDataGrid-columnHeader": { py: 0.5 },
        "& .MuiDataGrid-columnHeaderTitle": {
          fontWeight: 700,
          fontSize: "0.76rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "text.secondary",
          whiteSpace: "normal",
          lineHeight: 1.2,
        },
        // Wrap, never clip: content flows to the next line and the row grows
        // (getRowHeight: auto) instead of overflowing.
        "& .MuiDataGrid-cell": {
          borderColor: LINE,
          py: 1.25,
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: 1.4,
          display: "flex",
          alignItems: "center",
        },
        // The flex display above would otherwise defeat right-alignment of
        // type:"number" columns — numbers must keep a shared right edge.
        "& .MuiDataGrid-cell--textRight": { justifyContent: "flex-end" },
        "& .MuiDataGrid-row:hover": { bgcolor: "#f6f4ee" },
        // Keep the resize handle visible so columns can be dragged wider/narrower.
        "& .MuiDataGrid-columnSeparator": { color: LINE },
        "& .MuiDataGrid-footerContainer": { borderColor: LINE, minHeight: 48 },
        "& .MuiDataGrid-toolbarContainer": { p: 1.25, gap: 1 },
      }}
      {...rest}
    />
  );
}
