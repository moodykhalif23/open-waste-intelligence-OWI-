import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { DataGrid, useGridApiRef, type DataGridProps } from "@mui/x-data-grid";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { SearchField, Toolbar, meadow } from "./ui";
import { useI18n } from "../i18n";
import { owi } from "../theme";

export type { GridColDef } from "@mui/x-data-grid";

export function DataTable({
  pageSize = 10,
  toolbar = true,
  filters,
  actions,
  searchPlaceholder,
  ...rest
}: DataGridProps & {
  pageSize?: number;
  toolbar?: boolean;
  filters?: ReactNode;
  actions?: ReactNode;
  searchPlaceholder?: string;
}) {
  const { t } = useI18n();
  const apiRef = useGridApiRef();
  const [search, setSearch] = useState("");
  const sizes = Array.from(new Set([pageSize, 10, 25, 50, 100])).sort((a, b) => a - b);
  const searchable = toolbar && (search !== "" || (rest.rows?.length ?? 0) > pageSize);

  const onSearch = (value: string) => {
    setSearch(value);
    apiRef.current?.setQuickFilterValues(value.split(/\s+/).filter(Boolean));
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      {(toolbar || filters || actions) && (
        <Toolbar
          start={filters}
          end={
            <>
              {searchable && (
                <SearchField value={search} onChange={onSearch} placeholder={searchPlaceholder ?? t("search")} />
              )}
              {toolbar && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileDownloadOutlined />}
                  onClick={() => apiRef.current?.exportDataAsCsv({ utf8WithBom: true })}
                  sx={{ height: 36 }}
                >
                  {t("export")}
                </Button>
              )}
              {actions}
            </>
          }
        />
      )}
      <DataGrid
        apiRef={apiRef}
        autoHeight
        disableRowSelectionOnClick
        getRowHeight={() => "auto"}
        columnHeaderHeight={52}
        initialState={{ pagination: { paginationModel: { page: 0, pageSize } } }}
        pageSizeOptions={sizes}
        localeText={{
          paginationRowsPerPage: t("rowsPerPage"),
          paginationDisplayedRows: ({ from, to, count }) =>
            `${from.toLocaleString()}–${to.toLocaleString()} ${t("of")} ${count.toLocaleString()}`,
          noRowsLabel: t("noData"),
          noResultsOverlayLabel: t("noResults"),
        }}
        sx={{
          border: `1px solid ${owi.line}`,
          borderRadius: 1,
          bgcolor: "background.paper",
          fontSize: "0.92rem",
          color: owi.inkSoft,
          overflow: "hidden",
          "--DataGrid-containerBackground": "#ffffff",
          "--DataGrid-rowBorderColor": owi.rule,
          "& .MuiDataGrid-columnHeaders": {
            "--DataGrid-t-header-background-base": "transparent",
            borderBottom: "1px solid #d4e8c6",
            backgroundColor: "#ffffff",
            ...meadow(14),
          },
          "& .MuiDataGrid-columnHeader": { px: 1.75, pb: "14px" },
          "& .MuiDataGrid-columnHeaderTitle": {
            fontWeight: 700,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "text.secondary",
            whiteSpace: "normal",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          },
          "& .MuiDataGrid-columnHeader--alignRight .MuiDataGrid-columnHeaderTitle": { textAlign: "right" },
          "& .MuiDataGrid-columnHeader--alignCenter .MuiDataGrid-columnHeaderTitle": { textAlign: "center" },
          "& .MuiDataGrid-cell": {
            borderColor: owi.rule,
            px: 1.75,
            py: 1.1,
            minHeight: 48,
            whiteSpace: "normal",
            wordBreak: "break-word",
            lineHeight: 1.4,
            display: "flex",
            alignItems: "center",
          },
          "& .MuiDataGrid-cell--textRight": { justifyContent: "flex-end" },
          "& .MuiDataGrid-cell--textCenter": { justifyContent: "center" },
          "& .MuiDataGrid-cellEmpty, & .MuiDataGrid-filler": { p: 0 },
          "& .MuiDataGrid-row:hover": { bgcolor: "#faf8f3" },
          "& .MuiDataGrid-columnSeparator": { color: "transparent" },
          "& .MuiDataGrid-columnHeader:hover .MuiDataGrid-columnSeparator": { color: owi.line },
          "& .MuiDataGrid-iconButtonContainer .MuiIconButton-root, & .MuiDataGrid-menuIcon .MuiIconButton-root": {
            color: owi.faint,
          },
          "& .MuiDataGrid-footerContainer": { borderColor: owi.line, minHeight: 48 },
          "& .MuiTablePagination-root": { color: "text.secondary" },
          "& .MuiTablePagination-displayedRows": { fontVariantNumeric: "tabular-nums", fontWeight: 560 },
          "& .MuiDataGrid-overlay": { color: "text.secondary", fontSize: "0.9rem" },
        }}
        {...rest}
      />
    </Box>
  );
}
