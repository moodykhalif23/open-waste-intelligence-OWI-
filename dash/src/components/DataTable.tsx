import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { DataGrid, useGridApiRef, type DataGridProps } from "@mui/x-data-grid";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { SearchField, Toolbar } from "./ui";
import { useI18n } from "../i18n";
import { owi } from "../theme";

export type { GridColDef } from "@mui/x-data-grid";

const WOOD = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='640' height='48' viewBox='0 0 640 48' preserveAspectRatio='none'>
<filter id='g' x='0' y='0' width='100%' height='100%'>
<feTurbulence type='fractalNoise' baseFrequency='0.004 0.24' numOctaves='4' seed='11' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 0.55 0 0 0 0 0.4 0 0 0 0 0.18 1.5 0 0 0 -0.62'/>
</filter>
<rect width='640' height='48' fill='#f6ecd9'/>
<rect width='640' height='48' filter='url(#g)' opacity='0.55'/>
<g fill='none' stroke='#cfb48a' stroke-linecap='round'>
<path d='M0 8C130 8 190 12 320 12S510 8 640 8' stroke-width='0.9' opacity='0.55'/>
<path d='M0 19C110 19 210 15 320 15S530 19 640 19' stroke-width='0.7' opacity='0.45'/>
<path d='M0 29C150 29 170 33 320 33S490 29 640 29' stroke-width='1.1' opacity='0.5'/>
<path d='M0 40C120 40 200 37 320 37S520 40 640 40' stroke-width='0.7' opacity='0.4'/>
</g>
</svg>`)}")`;

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
        columnHeaderHeight={44}
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
            borderBottom: "1px solid #e4d3b2",
            backgroundColor: "#f6ecd9",
            backgroundImage: WOOD,
            backgroundSize: "640px 100%",
            backgroundRepeat: "repeat-x",
          },
          "& .MuiDataGrid-columnHeader": { px: 1.75 },
          "& .MuiDataGrid-columnHeaderTitle": {
            fontWeight: 700,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "#4a3410",
            whiteSpace: "normal",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          },
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
            color: "#8a6a3a",
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
