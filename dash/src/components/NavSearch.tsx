import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import { NAV } from "../nav";
import { useI18n, type StringKey } from "../i18n";

interface Dest {
  path: string;
  key: StringKey;
}

// A "jump to" search over every destination (standalone pages + section tabs).
// Real navigation, not decorative — pick a result and it routes there.
export default function NavSearch() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const options = useMemo<Dest[]>(() => {
    const out: Dest[] = [];
    for (const entry of NAV) {
      if (entry.children) entry.children.forEach((c) => out.push({ path: c.path, key: c.key }));
      else out.push({ path: entry.path, key: entry.key });
    }
    return out;
  }, []);

  return (
    <Autocomplete<Dest>
      options={options}
      getOptionLabel={(o) => t(o.key)}
      isOptionEqualToValue={(o, v) => o.path === v.path}
      onChange={(_, val) => {
        if (val) navigate(val.path);
      }}
      blurOnSelect
      size="small"
      sx={{ width: { xs: 150, sm: 220, md: 260 } }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={t("search")}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: "text.secondary", mx: 0.5 }} />,
            },
          }}
          sx={{
            "& .MuiOutlinedInput-root": { bgcolor: "#f1f5f4", borderRadius: "4px", py: 0.25 },
            "& fieldset": { border: "none" },
          }}
        />
      )}
    />
  );
}
