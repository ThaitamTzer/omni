import { FormEvent, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Switch,
  Stack,
  Tooltip,
  Avatar,
  Divider,
} from '@mui/material';
import { DeleteOutline, Add, AutoAwesome } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  useAiRulesQuery,
  useAddRule,
  useToggleRule,
  useDeleteRule,
} from '@/features/settings/api';
import EmptyState from '@/components/EmptyState';

export default function AiRulesSection() {
  const { t } = useTranslation();

  const [ruleName, setRuleName] = useState('');
  const [ruleKeywords, setRuleKeywords] = useState('');
  const [ruleTemplate, setRuleTemplate] = useState('');

  const rulesQuery = useAiRulesQuery();
  const addRuleMutation = useAddRule();
  const toggleRuleMutation = useToggleRule();
  const deleteRuleMutation = useDeleteRule();

  const rules = rulesQuery.data ?? [];

  const addRule = (e: FormEvent) => {
    e.preventDefault();
    addRuleMutation.mutate(
      {
        name: ruleName,
        keywords: ruleKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        responseTemplate: ruleTemplate || undefined,
      },
      {
        onSuccess: () => {
          setRuleName('');
          setRuleKeywords('');
          setRuleTemplate('');
        },
      },
    );
  };

  return (
    <Card elevation={0} sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: '#ede9fe', color: 'secondary.main' }}>
            <AutoAwesome fontSize="small" />
          </Avatar>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{t('settings.aiRules')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>{t('settings.aiRulesDesc')}</Typography>
          </Box>
        </Box>

        <Box component="form" onSubmit={addRule} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField placeholder={t('settings.ruleNamePh')} value={ruleName} onChange={(e) => setRuleName(e.target.value)} required size="small" />
            <TextField placeholder={t('settings.ruleKeywordPh')} value={ruleKeywords} onChange={(e) => setRuleKeywords(e.target.value)} required size="small" />
          </Box>
          <TextField placeholder={t('settings.ruleResponsePh')} value={ruleTemplate} onChange={(e) => setRuleTemplate(e.target.value)} size="small" multiline rows={2} />
          <Button type="submit" variant="contained" startIcon={<Add />} sx={{ alignSelf: 'flex-start' }} disabled={addRuleMutation.isPending}>
            {addRuleMutation.isPending ? t('settings.adding') : t('settings.addRule')}
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {rules.length === 0 ? (
          <EmptyState icon="⚙️" title={t('settings.emptyRules')} hint={t('settings.emptyRulesDesc')} />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('settings.colName')}</TableCell>
                <TableCell>{t('settings.colKeywords')}</TableCell>
                <TableCell>{t('settings.colPriority')}</TableCell>
                <TableCell>{t('settings.colEnabled')}</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {r.keywords.slice(0, 3).map((k) => (
                        <Chip key={k} label={k} size="small" variant="outlined" sx={{ fontSize: 11, height: 20 }} />
                      ))}
                      {r.keywords.length > 3 && <Chip label={`+${r.keywords.length - 3}`} size="small" sx={{ fontSize: 11, height: 20 }} />}
                    </Stack>
                  </TableCell>
                  <TableCell>{r.priority}</TableCell>
                  <TableCell>
                    <Switch size="small" checked={r.enabled} onChange={(e) => toggleRuleMutation.mutate({ id: r.id, enabled: e.target.checked })} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('settings.deleteRule')}>
                      <Button size="small" color="error" startIcon={<DeleteOutline />} onClick={() => deleteRuleMutation.mutate(r.id)}>
                        {t('settings.delete')}
                      </Button>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
