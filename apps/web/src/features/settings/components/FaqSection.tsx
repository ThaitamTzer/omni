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
import { useFaqsQuery, useAddFaq, useToggleFaq, useDeleteFaq } from '@/features/settings/api';
import EmptyState from '@/components/EmptyState';

export default function FaqSection() {
  const { t } = useTranslation();

  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqKeywords, setFaqKeywords] = useState('');
  const [faqCategory, setFaqCategory] = useState('');

  const faqsQuery = useFaqsQuery();
  const addFaqMutation = useAddFaq();
  const toggleFaqMutation = useToggleFaq();
  const deleteFaqMutation = useDeleteFaq();

  const faqs = faqsQuery.data ?? [];

  const addFaq = (e: FormEvent) => {
    e.preventDefault();
    addFaqMutation.mutate(
      {
        question: faqQuestion,
        answer: faqAnswer,
        keywords: faqKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        category: faqCategory || undefined,
      },
      {
        onSuccess: () => {
          setFaqQuestion('');
          setFaqAnswer('');
          setFaqKeywords('');
          setFaqCategory('');
        },
      },
    );
  };

  return (
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
                    <Switch size="small" checked={f.enabled} onChange={(e) => toggleFaqMutation.mutate({ id: f.id, enabled: e.target.checked })} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('settings.deleteFaq')}>
                      <Button size="small" color="error" startIcon={<DeleteOutline />} onClick={() => deleteFaqMutation.mutate(f.id)}>
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
