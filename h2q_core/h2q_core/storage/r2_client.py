"""
Cloudflare R2 client factory (S3-compatible via boto3).

Credentials are read from site_config.json — never hardcode secrets.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import frappe
from boto3.s3.transfer import TransferConfig
from botocore.client import BaseClient, Config


REQUIRED_CONFIG_KEYS = (
	"r2_account_id",
	"r2_access_key_id",
	"r2_secret_access_key",
	"r2_bucket",
	"r2_public_url",
)


def get_r2_settings() -> dict[str, Any]:
	"""Load and validate R2 settings from site_config / conf."""
	conf = frappe.conf
	missing = [key for key in REQUIRED_CONFIG_KEYS if not conf.get(key)]
	if missing:
		frappe.throw(
			f"Missing R2 site_config keys: {', '.join(missing)}. "
			"Add them to site_config.json before uploading files."
		)

	account_id = conf.get("r2_account_id")
	endpoint = conf.get("r2_endpoint_url") or f"https://{account_id}.r2.cloudflarestorage.com"
	public_url = str(conf.get("r2_public_url")).rstrip("/")

	return {
		"account_id": account_id,
		"access_key_id": conf.get("r2_access_key_id"),
		"secret_access_key": conf.get("r2_secret_access_key"),
		"bucket": conf.get("r2_bucket"),
		"endpoint_url": endpoint,
		"public_url": public_url,
		"region_name": conf.get("r2_region_name") or "auto",
		# Multipart threshold for CAD / site photos (bytes). Default 8 MiB.
		"multipart_threshold": int(conf.get("r2_multipart_threshold") or 8 * 1024 * 1024),
		"multipart_chunksize": int(conf.get("r2_multipart_chunksize") or 16 * 1024 * 1024),
		"max_concurrency": int(conf.get("r2_max_concurrency") or 4),
		"connect_timeout": int(conf.get("r2_connect_timeout") or 10),
		"read_timeout": int(conf.get("r2_read_timeout") or 120),
		"max_attempts": int(conf.get("r2_max_attempts") or 5),
	}


@lru_cache(maxsize=1)
def _build_client(
	endpoint_url: str,
	access_key_id: str,
	secret_access_key: str,
	region_name: str,
	connect_timeout: int,
	read_timeout: int,
	max_attempts: int,
) -> BaseClient:
	import boto3

	return boto3.client(
		service_name="s3",
		endpoint_url=endpoint_url,
		aws_access_key_id=access_key_id,
		aws_secret_access_key=secret_access_key,
		region_name=region_name,
		config=Config(
			signature_version="s3v4",
			retries={"max_attempts": max_attempts, "mode": "standard"},
			connect_timeout=connect_timeout,
			read_timeout=read_timeout,
			s3={"addressing_style": "path"},
		),
	)


def get_r2_client() -> tuple[BaseClient, dict[str, Any]]:
	"""Return a configured boto3 S3 client for R2 + settings dict."""
	settings = get_r2_settings()
	client = _build_client(
		endpoint_url=settings["endpoint_url"],
		access_key_id=settings["access_key_id"],
		secret_access_key=settings["secret_access_key"],
		region_name=settings["region_name"],
		connect_timeout=settings["connect_timeout"],
		read_timeout=settings["read_timeout"],
		max_attempts=settings["max_attempts"],
	)
	return client, settings


def get_transfer_config(settings: dict[str, Any] | None = None) -> TransferConfig:
	"""TransferConfig enables multipart streaming for large CAD / media files."""
	settings = settings or get_r2_settings()
	return TransferConfig(
		multipart_threshold=settings["multipart_threshold"],
		multipart_chunksize=settings["multipart_chunksize"],
		max_concurrency=settings["max_concurrency"],
		use_threads=True,
	)


def clear_r2_client_cache() -> None:
	"""Clear cached client (call after rotating credentials)."""
	_build_client.cache_clear()
