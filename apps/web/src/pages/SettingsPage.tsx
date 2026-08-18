import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  Grid,
  Divider,
} from '@mui/material';
import {
  DeleteOutline,
  Add,
  AutoAwesome,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import type { AiRuleDto, FaqDto } from '@omni/shared';

export default function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Rule form
  const [ruleName, setRuleName] = useState('');
  const [ruleKeywords, setRuleKeywords] = useState('');
  const [ruleTemplate, setRuleTemplate] = useState('');

  // FAQ form
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqKeywords, setFaqKeywords] = useState('');
  const [faqCategory, setFaqCategory] = useState('');

  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState('');
  const [aiTone, setAiTone] = useState('');
  const [aiMaxReplies, setAiMaxReplies] = useState('10');

  // ---- Queries ----
  const rulesQuery = useQuery({
    queryKey: ['ai-rules'],
    queryFn: () => api.get<AiRuleDto[]>('/settings/ai-rules'),
  });
  const faqsQuery = useQuery({
    queryKey: ['faqs'],
    queryFn: () => api.get<FaqDto[]>('/settings/faqs'),
  });
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, string>>('/settings'),
  });

  const rules = rulesQuery.data ?? [];
  const faqs = faqsQuery.data ?? [];

  // Sync local AI setting state when remote settings arrive
  useEffect(() => {
    if (settingsQuery.data) {
      setAiTone(settingsQuery.data.ai_tone ?? '');
      setAiMaxReplies(settingsQuery.data.ai_max_replies_per_hour ?? '10');
    }
  }, [settingsQuery.data]);

  const showMsg = (ok: string, err?: unknown) => {
    setMsg(ok);
    setMsgError(err ? `Lỗi: ${(err as Error).message}` : '');
  };

  const invalidate = (keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  // ---- Mutations ----
  const addRuleMutation = useMutation({
    mutationFn: () =>
      api.post('/settings/ai-rules', {
        name: ruleName,
        keywords: ruleKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        responseTemplate: ruleTemplate || undefined,
      }),
    onSuccess: () => {
      showMsg(t('settings.added'));
      setRuleName('');
      setRuleKeywords('');
      setRuleTemplate('');
      invalidate(['ai-rules']);
    },
    onError: (e) => showMsg('', e),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/settings/ai-rules/${id}`, { enabled }),
    onSuccess: () => invalidate(['ai-rules']),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => api.del(`/settings/ai-rules/${id}`),
    onSuccess: () => invalidate(['ai-rules']),
  });

  const addFaqMutation = useMutation({
    mutationFn: () =>
      api.post('/settings/faqs', {
        question: faqQuestion,
        answer: faqAnswer,
        keywords: faqKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        category: faqCategory || undefined,
      }),
    onSuccess: () => {
      showMsg(t('settings.faqAdded'));
      setFaqQuestion('');
      setFaqAnswer('');
      setFaqKeywords('');
      setFaqCategory('');
      invalidate(['faqs']);
    },
    onError: (e) => showMsg('', e),
  });

  const toggleFaqMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.patch(`/settings/faqs/${id}`, { enabled }),
    onSuccess: () => invalidate(['faqs']),
  });

  const deleteFaqMutation = useMutation({
    mutationFn: (id: string) => api.del(`/settings/faqs/${id}`),
    onSuccess: () => invalidate(['faqs']),
  });

  const saveSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => api.post('/settings', { key, value }),
    onSuccess: () => invalidate(['settings']),
  });

  const addRule = (e: FormEvent) => {
    e.preventDefault();
    addRuleMutation.mutate();
  };

  const toggleRule = (id: string, enabled: boolean) => toggleRuleMutation.mutate({ id, enabled });

  const deleteRule = (id: string) => deleteRuleMutation.mutate(id);

  const addFaq = (e: FormEvent) => {
    e.preventDefault();
    addFaqMutation.mutate();
  };

  const toggleFaq = (id: string, enabled: boolean) => toggleFaqMutation.mutate({ id, enabled });

  const deleteFaq = (id: string) => deleteFaqMutation.mutate(id);

  const saveAiSettings = () => {
    saveSettingMutation.mutate(
      { key: 'ai_tone', value: aiTone },
      {
        onSuccess: () => {
          saveSettingMutation.mutate({ key: 'ai_max_replies_per_hour', value: aiMaxReplies }, { onSuccess: () => showMsg(t('settings.saved')) });
        },
      },
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Toast message={msg} error={msgError} onClose={() => { setMsg(''); setMsgError(''); }} />

      {/* Page header — light, enterprise */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.3 }}>
          {t('settings.title')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
          {t('settings.subtitle')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* AI Rules */}
        <Grid item xs={12} lg={7}>
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
                          <Switch size="small" checked={r.enabled} onChange={(e) => toggleRule(r.id, e.target.checked)} />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={t('settings.deleteRule')}>
                            <Button size="small" color="error" startIcon={<DeleteOutline />} onClick={() => deleteRule(r.id)}>
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
        </Grid>

        {/* AI Settings */}
        <Grid item xs={12} lg={5}>
          <Card elevation={0} sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ width: 40, height: 40, bgcolor: '#eff6ff', color: 'primary.main' }}>
                  <SettingsIcon fontSize="small" />
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{t('settings.aiSettings')}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>{t('settings.aiSettingsDesc')}</Typography>
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>{t('settings.aiTone')}</Typography>
                <TextField
                  multiline
                  rows={3}
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder={t('settings.aiTonePh')}
                />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>{t('settings.aiReplyLimit')}</Typography>
                <TextField
                  type="number"
                  value={aiMaxReplies}
                  onChange={(e) => setAiMaxReplies(e.target.value)}
                  size="small"
                  fullWidth
                />
              </Box>
              <Button variant="contained" onClick={saveAiSettings} sx={{ alignSelf: 'flex-start' }} disabled={saveSettingMutation.isPending}>
                {saveSettingMutation.isPending ? t('settings.saving') : t('settings.save')}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* FAQ */}
        <Grid item xs={12}>
          <Card elevation={0} sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Avatar sx={{ width: 40, height: 40, bgcolor: '#eff6ff', color: 'primary.main' }}>
                  <AutoAwesome fontSize="small" />
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{t('settings.faq')}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>{t('settings.faqDesc')}</Typography>
                </Box>
              </Box>

              <Box component="form" onSubmit={addFaq} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <TextField placeholder={t('settings.faqQuestionPh')} value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} required size="small" />
                  <TextField placeholder={t('settings.faqCategoryPh')} value={faqCategory} onChange={(e) => setFaqCategory(e.target.value)} size="small" />
                </Box>
                <TextField placeholder={t('settings.faqAnswerPh')} value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} required size="small" multiline rows={2} />
                <TextField placeholder={t('settings.faqKeywordsPh')} value={faqKeywords} onChange={(e) => setFaqKeywords(e.target.value)} size="small" />
                <Button type="submit" variant="contained" startIcon={<Add />} sx={{ alignSelf: 'flex-start' }} disabled={addFaqMutation.isPending}>
                  {addFaqMutation.isPending ? t('settings.adding') : t('settings.addFaq')}
                </Button>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {faqs.length === 0 ? (
                <EmptyState icon="📖" title={t('settings.emptyFaqs')} hint={t('settings.emptyFaqsDesc')} />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('settings.faqColQuestion')}</TableCell>
                      <TableCell>{t('settings.faqColCategory')}</TableCell>
                      <TableCell>{t('settings.faqColKeywords')}</TableCell>
                      <TableCell>{t('settings.colEnabled')}</TableCell>
                      <TableCell align="right"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {faqs.map((f) => (
                      <TableRow key={f.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{f.question}</TableCell>
                        <TableCell>{f.category ?? '—'}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {f.keywords.slice(0, 3).map((k) => (
                              <Chip key={k} label={k} size="small" variant="outlined" sx={{ fontSize: 11, height: 20 }} />
                            ))}
                            {f.keywords.length > 3 && <Chip label={`+${f.keywords.length - 3}`} size="small" sx={{ fontSize: 11, height: 20 }} />}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Switch size="small" checked={f.enabled} onChange={(e) => toggleFaq(f.id, e.target.checked)} />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={t('settings.deleteFaq')}>
                            <Button size="small" color="error" startIcon={<DeleteOutline />} onClick={() => deleteFaq(f.id)}>
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
        </Grid>
      </Grid>
    </Box>
  );
}
