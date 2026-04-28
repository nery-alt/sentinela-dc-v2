import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'cadastros',
          columns: [
            { name: 'qual_desastre', type: 'string', isOptional: true },
            { name: 'qual_ajuda_defesa_civil', type: 'string', isOptional: true },
            { name: 'qual_deficiencia', type: 'string', isOptional: true },
            { name: 'qual_doenca_cronica', type: 'string', isOptional: true },
            { name: 'qual_medicamento', type: 'string', isOptional: true },
            { name: 'docs_faltantes', type: 'string', isOptional: true },
          ]
        }),
      ]
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'cadastros',
          columns: [
            { name: 'qual_material_construcao', type: 'string', isOptional: true },
            { name: 'obs_agua_potavel', type: 'string', isOptional: true },
            { name: 'obs_energia_eletrica', type: 'string', isOptional: true },
            { name: 'obs_saneamento_basico', type: 'string', isOptional: true },
            { name: 'obs_coleta_lixo', type: 'string', isOptional: true },
            { name: 'obs_banheiro', type: 'string', isOptional: true },
          ]
        }),
        addColumns({
          table: 'vistorias',
          columns: [
            { name: 'qual_tipificacao_outro', type: 'string', isOptional: true },
            { name: 'qual_material_outro', type: 'string', isOptional: true },
            { name: 'qual_estrutura_outro', type: 'string', isOptional: true },
            { name: 'qual_orgao_outro', type: 'string', isOptional: true },
            { name: 'obs_risco_estrutural', type: 'string', isOptional: true },
            { name: 'obs_risco_hidrologico', type: 'string', isOptional: true },
          ]
        }),
        addColumns({
          table: 'vistorias_tecnicas',
          columns: [
            { name: 'qual_extintor_outro', type: 'string', isOptional: true },
            { name: 'qual_orgao_outro', type: 'string', isOptional: true },
            { name: 'qual_sistema_fixo', type: 'string', isOptional: true },
            { name: 'obs_hidrante', type: 'string', isOptional: true },
            { name: 'obs_iluminacao', type: 'string', isOptional: true },
            { name: 'obs_planta_baixa', type: 'string', isOptional: true },
          ]
        }),
      ]
    },
  ]
});
