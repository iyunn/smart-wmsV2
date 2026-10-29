--
-- PostgreSQL database dump
--

\restrict 6ph3YvIRtVY84pzfBBS1MIbOfxbu0sBZXZqwN4iV5nxS6suKHQoT0KFW0UKehBJ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, username, nik, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'nik', '-'),
    NEW.email,
    'admin',     -- default role admin
    'pending'    -- WAJIB approval super admin dulu
  );
  RETURN NEW;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asset_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_notes (
    kode_asset text NOT NULL,
    catatan text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: assets_clean; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets_clean (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    raw_id uuid,
    original_description text,
    normalized_description text,
    jenis text,
    merk text,
    kategori text,
    status text,
    confidence text,
    created_at timestamp without time zone DEFAULT now(),
    tag text
);


--
-- Name: assets_raw; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets_raw (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    kode_asset text,
    deskripsi text,
    lokasi text,
    status text,
    source text DEFAULT 'DAT'::text,
    uploaded_at timestamp without time zone DEFAULT now(),
    toko text,
    kategori_oracle text,
    kuantitas integer DEFAULT 1,
    biaya_perolehan bigint DEFAULT 0,
    jumlah_tercatat bigint DEFAULT 0,
    invoice_number text,
    tanggal_dokumen text,
    sub_coce text DEFAULT '0'::text NOT NULL,
    is_prodsus boolean DEFAULT false NOT NULL
);


--
-- Name: classification_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    raw_id uuid,
    original_description text,
    result jsonb,
    confidence text,
    processed_at timestamp without time zone DEFAULT now()
);


--
-- Name: dat_closing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dat_closing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bulan text NOT NULL,
    cga text NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    total_qty numeric DEFAULT 0 NOT NULL,
    total_nilai numeric DEFAULT 0 NOT NULL,
    total_tercatat numeric DEFAULT 0 NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: keyword_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.keyword_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    keyword text NOT NULL,
    rule_type text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lpp_raw; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lpp_raw (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kode_asset text NOT NULL,
    toko text NOT NULL,
    deskripsi text,
    saldo_awal integer DEFAULT 0 NOT NULL,
    masuk integer DEFAULT 0 NOT NULL,
    keluar integer DEFAULT 0 NOT NULL,
    saldo_akhir integer DEFAULT 0 NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pendingan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pendingan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tujuan_id uuid NOT NULL,
    jenis text NOT NULL,
    qty integer DEFAULT 1 NOT NULL,
    keterangan text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    merk text DEFAULT ''::text,
    urgensi text DEFAULT 'sedang'::text,
    arah text DEFAULT 'kirim'::text,
    CONSTRAINT pendingan_items_qty_check CHECK ((qty > 0))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    nik text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    theme text DEFAULT 'dark'::text NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text]))),
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text]))),
    CONSTRAINT profiles_theme_check CHECK ((theme = ANY (ARRAY['dark'::text, 'light'::text])))
);


--
-- Name: sj_item_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sj_item_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nama text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sj_tujuan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sj_tujuan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kode text NOT NULL,
    nama text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    kota text,
    kecamatan text
);


--
-- Name: staging_area; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_area (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kode_asset text,
    jenis text DEFAULT ''::text,
    merk text DEFAULT ''::text,
    deskripsi text DEFAULT ''::text,
    catatan text DEFAULT ''::text,
    asal_toko text DEFAULT ''::text,
    is_at_lebih boolean DEFAULT false NOT NULL,
    sj_id uuid,
    tanggal_masuk date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: surat_jalan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surat_jalan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    no_sj text NOT NULL,
    tanggal date NOT NULL,
    tujuan_id uuid,
    pembawa text,
    penerima text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text DEFAULT 'Admin User'::text,
    approved_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_archived boolean DEFAULT false,
    jenis text DEFAULT 'keluar'::text NOT NULL,
    CONSTRAINT surat_jalan_jenis_check CHECK ((jenis = ANY (ARRAY['keluar'::text, 'masuk'::text])))
);


--
-- Name: surat_jalan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surat_jalan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sj_id uuid,
    urutan integer DEFAULT 1 NOT NULL,
    jenis text,
    merk text,
    serial_number text,
    qty integer DEFAULT 1,
    satuan text DEFAULT 'Unit'::text,
    is_baru boolean DEFAULT false,
    is_aktiva boolean DEFAULT false,
    keterangan text,
    mutasi_oracle_status boolean DEFAULT false,
    mutasi_oracle_at timestamp with time zone,
    kode_asset text,
    created_at timestamp with time zone DEFAULT now(),
    mutasi_wt_status boolean DEFAULT false,
    mutasi_wt_at timestamp with time zone
);


--
-- Name: asset_notes asset_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_notes
    ADD CONSTRAINT asset_notes_pkey PRIMARY KEY (kode_asset);


--
-- Name: assets_clean assets_clean_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets_clean
    ADD CONSTRAINT assets_clean_pkey PRIMARY KEY (id);


--
-- Name: assets_clean assets_clean_raw_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets_clean
    ADD CONSTRAINT assets_clean_raw_id_unique UNIQUE (raw_id);


--
-- Name: assets_raw assets_raw_kode_asset_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets_raw
    ADD CONSTRAINT assets_raw_kode_asset_unique UNIQUE (kode_asset);


--
-- Name: assets_raw assets_raw_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets_raw
    ADD CONSTRAINT assets_raw_pkey PRIMARY KEY (id);


--
-- Name: classification_logs classification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_logs
    ADD CONSTRAINT classification_logs_pkey PRIMARY KEY (id);


--
-- Name: dat_closing dat_closing_bulan_cga_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dat_closing
    ADD CONSTRAINT dat_closing_bulan_cga_key UNIQUE (bulan, cga);


--
-- Name: dat_closing dat_closing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dat_closing
    ADD CONSTRAINT dat_closing_pkey PRIMARY KEY (id);


--
-- Name: keyword_rules keyword_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keyword_rules
    ADD CONSTRAINT keyword_rules_pkey PRIMARY KEY (id);


--
-- Name: lpp_raw lpp_raw_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lpp_raw
    ADD CONSTRAINT lpp_raw_pkey PRIMARY KEY (id);


--
-- Name: pendingan_items pendingan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pendingan_items
    ADD CONSTRAINT pendingan_items_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: sj_item_templates sj_item_templates_nama_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sj_item_templates
    ADD CONSTRAINT sj_item_templates_nama_key UNIQUE (nama);


--
-- Name: sj_item_templates sj_item_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sj_item_templates
    ADD CONSTRAINT sj_item_templates_pkey PRIMARY KEY (id);


--
-- Name: sj_tujuan sj_tujuan_kode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sj_tujuan
    ADD CONSTRAINT sj_tujuan_kode_key UNIQUE (kode);


--
-- Name: sj_tujuan sj_tujuan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sj_tujuan
    ADD CONSTRAINT sj_tujuan_pkey PRIMARY KEY (id);


--
-- Name: staging_area staging_area_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_area
    ADD CONSTRAINT staging_area_pkey PRIMARY KEY (id);


--
-- Name: surat_jalan_items surat_jalan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surat_jalan_items
    ADD CONSTRAINT surat_jalan_items_pkey PRIMARY KEY (id);


--
-- Name: surat_jalan surat_jalan_no_sj_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surat_jalan
    ADD CONSTRAINT surat_jalan_no_sj_key UNIQUE (no_sj);


--
-- Name: surat_jalan surat_jalan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surat_jalan
    ADD CONSTRAINT surat_jalan_pkey PRIMARY KEY (id);


--
-- Name: idx_assets_clean_jenis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_clean_jenis ON public.assets_clean USING btree (jenis);


--
-- Name: idx_assets_clean_merk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_clean_merk ON public.assets_clean USING btree (merk);


--
-- Name: idx_assets_clean_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_clean_status ON public.assets_clean USING btree (status);


--
-- Name: idx_assets_clean_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_clean_tag ON public.assets_clean USING btree (tag) WHERE (tag IS NOT NULL);


--
-- Name: idx_assets_raw_is_prodsus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_raw_is_prodsus ON public.assets_raw USING btree (is_prodsus);


--
-- Name: idx_assets_raw_kode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_raw_kode ON public.assets_raw USING btree (kode_asset);


--
-- Name: idx_assets_raw_toko; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_raw_toko ON public.assets_raw USING btree (toko);


--
-- Name: idx_assets_raw_toko_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_raw_toko_id ON public.assets_raw USING btree (toko, id);


--
-- Name: idx_assets_raw_uploaded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_raw_uploaded_at ON public.assets_raw USING btree (uploaded_at DESC);


--
-- Name: idx_dat_closing_bulan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dat_closing_bulan ON public.dat_closing USING btree (bulan);


--
-- Name: idx_dat_closing_cga; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dat_closing_cga ON public.dat_closing USING btree (cga);


--
-- Name: idx_lpp_raw_kode_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lpp_raw_kode_asset ON public.lpp_raw USING btree (kode_asset);


--
-- Name: idx_lpp_raw_toko; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lpp_raw_toko ON public.lpp_raw USING btree (toko);


--
-- Name: idx_pendingan_items_arah; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pendingan_items_arah ON public.pendingan_items USING btree (arah);


--
-- Name: idx_pendingan_items_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pendingan_items_created ON public.pendingan_items USING btree (created_at);


--
-- Name: idx_pendingan_items_tujuan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pendingan_items_tujuan ON public.pendingan_items USING btree (tujuan_id);


--
-- Name: idx_pendingan_items_urgensi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pendingan_items_urgensi ON public.pendingan_items USING btree (urgensi);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_profiles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_status ON public.profiles USING btree (status);


--
-- Name: idx_sj_items_jenis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sj_items_jenis ON public.surat_jalan_items USING btree (jenis);


--
-- Name: idx_sj_items_mutasi_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sj_items_mutasi_status ON public.surat_jalan_items USING btree (mutasi_oracle_status);


--
-- Name: idx_sj_items_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sj_items_serial ON public.surat_jalan_items USING btree (serial_number);


--
-- Name: idx_sj_items_sj_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sj_items_sj_id ON public.surat_jalan_items USING btree (sj_id);


--
-- Name: idx_sj_tujuan_kota; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sj_tujuan_kota ON public.sj_tujuan USING btree (kota);


--
-- Name: idx_staging_at_lebih; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staging_at_lebih ON public.staging_area USING btree (is_at_lebih);


--
-- Name: idx_staging_kode_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staging_kode_asset ON public.staging_area USING btree (kode_asset);


--
-- Name: idx_surat_jalan_jenis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surat_jalan_jenis ON public.surat_jalan USING btree (jenis);


--
-- Name: idx_surat_jalan_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surat_jalan_status ON public.surat_jalan USING btree (status);


--
-- Name: idx_surat_jalan_tanggal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surat_jalan_tanggal ON public.surat_jalan USING btree (tanggal DESC);


--
-- Name: idx_surat_jalan_tujuan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surat_jalan_tujuan ON public.surat_jalan USING btree (tujuan_id);


--
-- Name: assets_clean assets_clean_raw_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets_clean
    ADD CONSTRAINT assets_clean_raw_id_fkey FOREIGN KEY (raw_id) REFERENCES public.assets_raw(id) ON DELETE CASCADE;


--
-- Name: pendingan_items pendingan_items_tujuan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pendingan_items
    ADD CONSTRAINT pendingan_items_tujuan_id_fkey FOREIGN KEY (tujuan_id) REFERENCES public.sj_tujuan(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: staging_area staging_area_sj_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_area
    ADD CONSTRAINT staging_area_sj_id_fkey FOREIGN KEY (sj_id) REFERENCES public.surat_jalan(id) ON DELETE SET NULL;


--
-- Name: surat_jalan_items surat_jalan_items_sj_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surat_jalan_items
    ADD CONSTRAINT surat_jalan_items_sj_id_fkey FOREIGN KEY (sj_id) REFERENCES public.surat_jalan(id) ON DELETE CASCADE;


--
-- Name: surat_jalan surat_jalan_tujuan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surat_jalan
    ADD CONSTRAINT surat_jalan_tujuan_id_fkey FOREIGN KEY (tujuan_id) REFERENCES public.sj_tujuan(id) ON DELETE RESTRICT;


--
-- Name: classification_logs Allow all for logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for logs" ON public.classification_logs USING (true) WITH CHECK (true);


--
-- Name: assets_clean Allow all for now - clean; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for now - clean" ON public.assets_clean USING (true) WITH CHECK (true);


--
-- Name: assets_raw Allow all for now - raw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all for now - raw" ON public.assets_raw USING (true) WITH CHECK (true);


--
-- Name: asset_notes Allow all on asset_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all on asset_notes" ON public.asset_notes USING (true) WITH CHECK (true);


--
-- Name: lpp_raw Allow all on lpp_raw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all on lpp_raw" ON public.lpp_raw USING (true) WITH CHECK (true);


--
-- Name: sj_item_templates Allow all on sj_item_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all on sj_item_templates" ON public.sj_item_templates USING (true) WITH CHECK (true);


--
-- Name: sj_tujuan Allow all on sj_tujuan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all on sj_tujuan" ON public.sj_tujuan USING (true) WITH CHECK (true);


--
-- Name: surat_jalan Allow all on surat_jalan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all on surat_jalan" ON public.surat_jalan USING (true) WITH CHECK (true);


--
-- Name: surat_jalan_items Allow all on surat_jalan_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all on surat_jalan_items" ON public.surat_jalan_items USING (true) WITH CHECK (true);


--
-- Name: keyword_rules allow all keyword rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow all keyword rules" ON public.keyword_rules USING (true) WITH CHECK (true);


--
-- Name: staging_area allow_all_staging; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_staging ON public.staging_area USING (true) WITH CHECK (true);


--
-- Name: asset_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: assets_clean; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets_clean ENABLE ROW LEVEL SECURITY;

--
-- Name: assets_raw; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets_raw ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles authenticated_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: classification_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classification_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: dat_closing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dat_closing ENABLE ROW LEVEL SECURITY;

--
-- Name: keyword_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.keyword_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: lpp_raw; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lpp_raw ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: dat_closing public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read ON public.dat_closing FOR SELECT USING (true);


--
-- Name: dat_closing public_upsert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_upsert ON public.dat_closing FOR UPDATE USING (true);


--
-- Name: dat_closing public_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_write ON public.dat_closing FOR INSERT WITH CHECK (true);


--
-- Name: sj_item_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sj_item_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: sj_tujuan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sj_tujuan ENABLE ROW LEVEL SECURITY;

--
-- Name: staging_area; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staging_area ENABLE ROW LEVEL SECURITY;

--
-- Name: surat_jalan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.surat_jalan ENABLE ROW LEVEL SECURITY;

--
-- Name: surat_jalan_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.surat_jalan_items ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 6ph3YvIRtVY84pzfBBS1MIbOfxbu0sBZXZqwN4iV5nxS6suKHQoT0KFW0UKehBJ

